/**
 * Worker related task
 */

//Dependencies
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const url = require('url');
const helpers = require('./helpers');
const __data = require('./data');
const __logs = require('./logs');
const util = require('util');
const debug = util.debuglog("workers")

//Instantiate the worker object
const workers = {};

//Look Up all checks, get their data and sends to validator
workers.gatherAllChecks = function() {
    __data.list("checks", function (err, checks) {
        if (!err && checks && checks.length > 0) {
            checks.forEach(function(check){
                __data.read("checks", check, function(error, originalCheckData) {
                    if (!error && originalCheckData) {
                        workers.validateCheckData(originalCheckData);
                    } else {
                        debug("Error in reading data", error);
                    }
                })
            })
        } else {
            debug("Could not find any checks to process");
        }
    })
}
//Sanity-check the check-data
workers.validateCheckData = function(originalCheckData) {
    originalCheckData = typeof originalCheckData === 'object' && originalCheckData !== null? originalCheckData : {};
    originalCheckData.id = typeof originalCheckData.id === 'string' && originalCheckData.id.trim().length === 20  ? originalCheckData.id.trim() : false;
    originalCheckData.phoneNumber = typeof originalCheckData.phoneNumber === 'string' && originalCheckData.phoneNumber.trim().length == 13 ? originalCheckData.phoneNumber.trim() : false;
    originalCheckData.protocol = typeof (originalCheckData.protocol) === "string" && ["http", "https"].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof (originalCheckData.url) === "string" && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof (originalCheckData.method) === "string" && ["get", "put", "post", "delete"].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
    originalCheckData.statusCodes = typeof (originalCheckData.statusCodes) === "object" && originalCheckData.statusCodes instanceof Array && originalCheckData.statusCodes.length > 0 ? originalCheckData.statusCodes : false;
    originalCheckData.timeoutSeconds = typeof (originalCheckData.timeoutSeconds) === "number" && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

    originalCheckData.state = typeof (originalCheckData.state) === "object" && ["up","down"].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : "down";
    originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) === "number" && originalCheckData.lastChecked  > 0 ? originalCheckData.lastChecked : false;

    //If all check passes, pass the data along to the next step in the process
    if (originalCheckData.id && originalCheckData.phoneNumber && originalCheckData.protocol && originalCheckData.url && originalCheckData.method && originalCheckData.statusCodes && originalCheckData.timeoutSeconds){
        workers.performCheck(originalCheckData);
    } else {
        debug("Error : One of the check field is not properly formatted. Skipping it ");
    }

}

//Perform the check, send the original check data and the outcome of the check process
workers.performCheck = function(originalCheckData){
    //Prepare the initial check outcome
    const checkOutcome = {
        'error': false,
        'responseCode': false
    }

    //Mark that the outcome hasn't been sent
    let outcomeSent = false;

    //Pars out the hostname and the path out of the original check data
    const parsedUrl = url.parse(originalCheckData.protocol + "://" + originalCheckData.url, true);
    
    const hostname = parsedUrl.hostname;
    let urlPath = parsedUrl.path // Using path and not pathname because we want the query string

    //Construct the request
    const requestDetails = {
        'protocol': originalCheckData.protocol + ':',
        'hostname': hostname,
        'method': originalCheckData.method.toLowerCase(),
        'path': urlPath,
        'timeout': originalCheckData.timeoutSeconds * 1000
    };

    //Instantiate the request object (either use the http or https module);
    const _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
    const req = _moduleToUse.request(requestDetails, function(res){
        //Grab the status code from the response
        const status = res.statusCode;

        //Update the checkoutcome and pass the data along
        checkOutcome.responseCode = status;
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    //Bind to the error event, so it doesn't get thrown
    req.on('error', function(e){
        checkOutcome.error = {
            'error': true,
            'value': e
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    //Bind to the timeout event
    req.on('timeout', function(e){
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    //End the request
    req.end();

}

//Process the check outcome, update the check data as needed, trigger an alert to the user if needed
//Special logic for accomodating a check that has never been tested before
workers.processCheckOutcome = function(originalCheckData, checkOutcome){
    //Decide if the check is considered up or down
    const state = checkOutcome.responseCode && !checkOutcome.error && originalCheckData.statusCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';
    
    //Decide if an alert is wanted
    const alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;
    
    //Log the outcome
    const timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);
    
    //Update the checkData
    const newCheckData =  originalCheckData;
    newCheckData.lastChecked = timeOfCheck;
    newCheckData.state = state;

    //Save to disk
    __data.update("checks", newCheckData.id, newCheckData, function(err){
        if (!err) {
            //Send the updated check data to the next phase in the process if needed
            if (alertWarranted) {
                workers.alertUserToStatusChange(newCheckData);
            } else {
                debug("Check outcome has not changed, no alert needed");
            }
        } else {
            debug("Error trying to save updates to one of checks");
        }
    })

}

//Alert the user as to the change in their check
workers.alertUserToStatusChange = function(newCheckData){
    const msg = 'Alert: Your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol + '//:' + newCheckData.url + ' is ' + newCheckData.state;
   
    helpers.sendTwilioSms(newCheckData.phoneNumber, msg, function(err){
        if (!err) {
            debug("Success: User was alerted to a status change in their check, via sms", msg);
        } else {
            debug("Error : Could not send sms alert to user who had a state change in their change",err);
        }
    })
}

workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck){
    //Form the log data
    const logData = {
        "check":originalCheckData,
        "outcome":checkOutcome,
        "state":state,
        "alert":alertWarranted,
        "time":timeOfCheck
    }

    //Covert data to a string
    const stringLogData = JSON.stringify(logData);

    //Determine the name of the log file
    const logFileName = originalCheckData.id;

    //Append the log string to the file
    __logs.append(logFileName, stringLogData, function(err){
        if (!err) {
            debug("Logging to file succedded");
        } else {
            debug('logging to file failed', err);
        }
    })
}


//Timer to excute the worker-process once per minute
workers.loop = function() {
    setInterval(workers.gatherAllChecks, 1000 * 60);
}

//Rotate (compress) the log files
workers.rotateLogs = function(){
    //List all the (non-compressed) log filess
    __logs.list(false, function(err, logs){
        if (!err && logs && logs.length > 0) {
            logs.forEach(function(logName){
                //Compress the file to a different file
                const logId = logName.replace(".log", '');
                const newFileId = logId + "-" + Date.now();
                __logs.compress(logId, newFileId, function(err){
                    if (!err) {
                        //Truncate the log (i.e empty the log file after compressing)
                        __logs.truncate(logId, function(e){
                            if (!e) {
                                debug("Success truncating log file");
                            } else {
                                debug("Error truncating log file");
                            }
                        })

                    } else {
                        debug("Error compressing one of the file", err);
                    }
                })
            })
        } else {
            debug("Error: Couldn't find any logs to rotate");
        }
    })
}

//Timer to perform log rotation once per day
workers.logRotationLoop = function() {
    setInterval(workers.rotateLogs, 1000 * 60 * 60 * 24);
}

//Init Script
workers.init = function(){
    //Send to console in yellow
    console.log('\x1b[33m%s\x1b[0m','Background workers are running');

    //Execute all the checks immediately
    workers.gatherAllChecks();

    //Call the loop so the check will execute later on
    workers.loop();

    //Compress all the logs immediately
    workers.rotateLogs();

    //Call the compression loop so compression will be done later on
    workers.logRotationLoop();
}


//Export the module
module.exports = workers;
