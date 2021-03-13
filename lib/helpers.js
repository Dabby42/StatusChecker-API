

//Dependencies
const crypto = require('crypto');
const config = require('./config');
const queryString = require('querystring');
const https = require('https');


//Helpers conatiner
const helpers = {};


//Helper methods
helpers.hash = function(str){
    if (typeof(str) === 'string' && str.length > 0) {
        const hash = crypto.createHmac("sha256", config.hashingSecret).update(str).digest('hex');
        return hash;
    } else {
        return false
    }
}

//Parsed Json Object to String in all cases without throwing
helpers.parsedJsonToObject = function (str){
    try {
        var obj = JSON.parse(str);
        return obj;
    } catch(err){
        return {};
    }  
}

helpers.createRandomString = function(strLength){
    strLength = typeof(strLength) === 'number' && strLength > 0 ? strLength : false;
    if (strLength) {
        const possibleCharacters = "abcdefghijklmnopqrstuvwxyz0123456789";
        let str = "";

        for (let i = 0; i < strLength; i++) {
            let randomChar = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length))
            str += randomChar;
        }
        return str;
    } else {
        return false;
    }
}

//Send sms to number helper
helpers.sendTwilioSms = function (phoneNumber, msg, callback){
    //Validate fields
    phoneNumber = typeof(phoneNumber) === 'string' && phoneNumber.trim().length >= 10 ? phoneNumber.trim() : false;
    msg = typeof(msg) === 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;

    if (phoneNumber && msg) {
        //Configure the request payload
        const payload = {
            "From": config.twilio.from,
            "To": "+" + phoneNumber,
            "Body": msg
        }
        const stringPayload = queryString.stringify(payload);
        
        //Configure the request Object
        const requestDetails = {
            "protocol": "https:",
            "method": "POST",
            "hostname": "api.twilio.com",
            "path": "/2010-04-01/Accounts/" + config.twilio.accountSid + "/Messages.json",
            "auth": config.twilio.accountSid+":"+config.twilio.authToken,
            "headers": {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(stringPayload)
            }
        }
       
        //Instantiate the request 
        const req = https.request(requestDetails, function(res){
            const status = res.statusCode
           
            if (status === 200 || status === 201) {
                callback(false);
            } else {
                callback("Status code returned is " + status);
            }
        })

        req.on('error', function(e){
            callback(e)
        })

        req.write(stringPayload);

        //End the request
        req.end();
    } else {
        callback("Given parameters were mising or invalid")
    }
}

//Export module
module.exports = helpers;