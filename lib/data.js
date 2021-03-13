/*
*This library is used for storing and editing data
*
*/

const fs = require('fs');
const path = require('path');
const helper = require('./helpers');

//Container for the module to be exported 
const lib = {};

lib.baseDir = path.join(__dirname, "/../.data/")

//Create a file
lib.create = function(dir, file, data, callback){
    //Open file for writing
    fs.open(lib.baseDir+ dir + '/'+file+'.json','wx', function(err, fileDescriptor){
        if (!err && fileDescriptor) {
            //Converting Json to strng
            let stringData = JSON.stringify(data);
            //Write to file and close it
            fs.writeFile(fileDescriptor, stringData, function(error){
                if (!error){
                    fs.close(fileDescriptor, function(e){
                        if(!e){
                            callback(false);
                        } else {
                            callback("Error closing file")
                        }
                    });
                }else {
                    callback("Couldn't write to file specified")
                }
            })

        } else {
            callback("Couldn't open file, it may already exist");
        }
    })
}

//Read data from file
lib.read = function(dir, file, callback){
    fs.readFile(lib.baseDir+dir+'/'+file+'.json', 'utf8', function(error, data){
        const parsedData = helper.parsedJsonToObject(data);
        if (!error && parsedData) {
            callback(error, parsedData);
        } else {
            callback(error, data);
        }
    })
}

//Update file data
lib.update = function(dir, file, data, callback){
    //Open file for writing
    fs.open(lib.baseDir+ dir+'/'+file+'.json', 'r+', function(err, fileDescriptor){
        if (!err && fileDescriptor) {
            //Converting Json to strng
            let stringData = JSON.stringify(data);

            //Truncate the file
            fs.ftruncate(fileDescriptor, function(error){
                if (!error) {
                    fs.writeFile(fileDescriptor, stringData, function(e){
                        if (!e) {
                            fs.close(fileDescriptor, function(e){
                                if (!e) {
                                    callback(false);
                                } else {
                                    callback("Error closing file");
                                }
                            })
                        } else {
                            callback("Error writing to existing file");
                        }
                    })
                } else {
                    callback("Error truncating file");
                }
            })
        } else {
            callback("Couldn't open file, it may not exist");
        }
    })
}

//Deleting a file
lib.delete = function(dir, file, callback){
    fs.unlink(lib.baseDir+ dir + '/'+file+'.json', function (err) {
        if (!err) {
            callback(false);
        } else {
            callback("Error deleting file");
        }
    })
}

//List all files in a directory
lib.list = function(dir, callback){
    fs.readdir(lib.baseDir+ dir + '/', function(err, data){
        if (!err && data && data.length > 0) {
            const trimmedFileNames = [];
            data.forEach(function(fileName){
                trimmedFileNames.push(fileName.replace(".json",''))
            })
            callback(false, trimmedFileNames);
        } else {
            callback(err,data);
        }
    })
}




module.exports = lib;