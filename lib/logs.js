/**
 * Library for storing and rotating logs
 */


//Dependencies needed
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');

//Initialize the library module
const lib = {};

//Base directory of the log folder
const libBaseDir = path.join(__dirname, '/../.logs/');

//Append a string to a file, create the file if it doesn't exist. The 'a' file signifies creating new file if file doesn't exist
lib.append = function (file, stringData, callback) {
    fs.open(libBaseDir + file + ".log", 'a', function(err, fileDescriptor){
        if (!err && fileDescriptor) {
            fs.appendFile(fileDescriptor, stringData + '\n', function(error){
                if (!error) {
                    fs.close(fileDescriptor, function(e){
                        if (!e) {
                            callback(false);
                        } else {
                            callback("Error closing file that was being appended")
                        }
                    })
                } else {
                    callback("Error appending to file")
                }
            })
        } else {
            callback("Could not open file for appending")
        }
    })
}

//List all the logs and optionally include the compressed logs (due to the boolean provided)
lib.list = function(includeCompressedLogs, callback){
    fs.readdir(libBaseDir, function(err, data){
        if (!err && data && data.length > 0) {
            const trimmedFileNames = [];
            data.forEach(function(fileName){
                //Add the .log files
                if (fileName.indexOf('.log') > -1) {
                    trimmedFileNames.push(fileName.replace('.log',''));
                }
                
                //Add the .gz files
                if (fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
                    trimmedFileNames.push(fileName.replace('.gz.b64',''))
                }
            })
            callback(false, trimmedFileNames);
        } else {
            console.log(err,data);
        }
    })
}

//Compress the contents of one .log file into a .gzb64 within the same directory.
lib.compress = function(logId, newFileId, callback){
    const sourceFile = logId + '.log';
    const destFile = newFileId + '.gz.b64';

    //Read the source file
    fs.readFile(libBaseDir + sourceFile, 'utf8', function(err, inputString){
        if (!err && inputString) {
            //Compress the data using gzip
            zlib.gzip(inputString, function(err, buffer){
                if (!err && buffer) {
                    //Send the compressed data to the destination file
                    fs.open(libBaseDir + destFile, 'wx', function(error, fileDescriptor){
                        if (!error && fileDescriptor) {
                            //Write to destination file
                            fs.writeFile(fileDescriptor, buffer.toString('base64'), function (err) {
                                if (!err) {
                                    //Close the destination file
                                    fs.close(fileDescriptor, function (e){
                                        if (!e) {
                                            callback(false)
                                        } else {
                                            callback(e)
                                        }
                                    })
                                } else {
                                    console.log(err);
                                }
                            })
                        } else {
                            callback(error)
                        }
                    })
                } else {
                    callback(err)
                }
            })
        } else {
            callback(err)
        }
    })
}

//Decompress the contents of a .gz.b64 file into a string variable
lib.decompress = function(fieldId, callback){
    const fileName = fieldId + '.gz.b64';
    fs.readFile( libBaseDir + fileName, 'utf8', function(err, data){
        if (!err && data) {
            //Decompress the data 
            const inputBuffer = Buffer.from(data, 'base64');
            zlib.unzip(inputBuffer, function(err, outputBuffer){
                if (!err && outputBuffer){
                     //Callback
                     const str = outputBuffer.toString();
                     callback(err, str);
                } else {
                    callback(err)
                }
            })
        } else {
            callback(err);
        }
    })
}

//Truncate a log file (i.e empty a log file)
lib.truncate = function(logId, callback){
    fs.truncate(libBaseDir + logId + '.log', 0, function(err){
        if (!err) {
            callback(false);
        } else {
            console.log(err); 
        }
    })
}

module.exports = lib;