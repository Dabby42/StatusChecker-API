/**
 * Request handlers
 */


//Dependencies
const __data = require("./data");
const helpers = require("./helpers");
const config = require("./config");

//Define the handler
const handler = {};

handler.users = function(data, callback){
    const acceptableMethods = ["get", "put", "post", "delete"];
    if (acceptableMethods.indexOf(data.method) > -1) {
        console.log(data.method)
        handlers.__users[data.method](data, callback);
    } else {
        callback(405);
    }
}

//Conatiners for the user submethods
const handlers = {};

handlers.__users = {};

//Users - put
//Required - phoneNumber
//Optional - firstName, lastName, password (at least one must be specified)
handlers.__users.put = function(data, callback){
    //Required field
    const phoneNumber = typeof (data.payload.phoneNumber) === "string" && data.payload.phoneNumber.trim().length === 10 ? data.payload.phoneNumber.trim() : false;

    //Optional feilds to update
    const firstName = typeof (data.payload.firstName) === "string" && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    const lastName = typeof (data.payload.lastName) === "string" && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    const password = typeof (data.payload.password) === "string" && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

    if (phoneNumber) { 
        if (firstName || lastName || password) {

            const token = typeof(data.headers.token) === "string" ? data.headers.token : false
            //Verify that the given token is valid for the phoneNumber
            handlers.__tokens.verifyToken(token, phoneNumber, function(tokenIsValid){
                if (tokenIsValid){
                    __data.read("users", phoneNumber, function(err, userData){
                        if (!err && userData){
                            if (firstName) {
                                userData.firstName = firstName;
                            }
                            if (lastName) {
                                userData.lastName = lastName;
                            }
                            if (password) {
                                userData.password = helpers.hash(password);
                            }
        
                            //Store the updated user data
                            __data.update("users", phoneNumber, userData, function(error){
                                if (!error) {
                                    callback(200)
                                } else {
                                    callback(500,{"Error":"Could not update user"});
                                }
                            })
                        } else {
                            callback(500, {"Error":"the specified user doesn't exist"})
                        }
                    })
                } else {
                    callback(403, {"Error": "Missing required token field in header or token is invalid"})
                }
            });
        } else {
            callback(400, {"Error":"Missing field to Update"})
        }
    } else {
        callback(400, {"Error":"Missing required field"})
    }
    
}

//Users - post
//Expected data should include firstName, lastName, phoneNumber, password and tosAgreement
handlers.__users.post = function(data,callback){
    //Check that all required field are filled out
    const firstName = typeof (data.payload.firstName) === "string" && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    const lastName = typeof (data.payload.lastName) === "string" && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    const phoneNumber = typeof (data.payload.phoneNumber) === "string" && data.payload.phoneNumber.trim().length === 13 ? data.payload.phoneNumber.trim() : false;
    const password = typeof (data.payload.password) === "string" && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    const tosAgreement = typeof (data.payload.tosAgreement) === "boolean" && data.payload.tosAgreement === true ? true : false;

    if (firstName && lastName && phoneNumber && password && tosAgreement) {
        //Make sure that user doesn't already exist
        __data.read("users",phoneNumber, function(err, fileData){
            if (err) {
                //Make the password hashed
                const hashedPassword = helpers.hash(password);

                if (hashedPassword) {
                    //Create the user object
                    const userObject = {
                        "firstName": firstName,
                        "lastName": lastName,
                        "phoneNumber": phoneNumber,
                        "password": hashedPassword,
                        "tosAgreement": true
                    }

                    //Store the user data
                    __data.create("users", phoneNumber, userObject, function(error){
                        if (!error) {
                            callback(200);
                        } else {
                            console.log(err);
                            callback(500,{"Error": "Could not create the new user"})
                        }
                    })
                } else {
                    callback(500,{"Error":"Could not hash user"})
                }
                
                
            } else {
                //User with the phoner number already exist
                callback(400, {"Error": "User already exists"})
            }
        })
    } else {
        callback(400, {"Error":"Missing required fields"});
    }
}

//Users - get
//Required data - phoneNumber
//Optional data - none
handlers.__users.get = function(data, callback){
    const phoneNumber = typeof(data.queryStringObject.phoneNumber) === "string" && data.queryStringObject.phoneNumber.trim().length == 10? data.queryStringObject.phoneNumber.trim() : false;
    if (phoneNumber) {

        const token = typeof(data.headers.token) === "string" ? data.headers.token : false
        //Verify that the given token is valid for the phoneNumber
        handlers.__tokens.verifyToken(token, phoneNumber, function(tokenIsValid){
            if (tokenIsValid){
                //Look Up the User
                __data.read("users", phoneNumber, function(err, data){
                    if (!err) {
                        //Remove the hashed Password from the user object before returning it to the user
                        delete data.password;
                        callback(200, data);  
                    } else {
                        callback(404);
                    }
                })
            } else {
                callback(403, {"Error": "Missing required token field in header or token is invalid"})
            }
        })
        
    } else {
        callback(400, {"Error": "Missing required fields"})
    }
}

//Users - delete
//Required fields - phoneNumber
//Clean Up (delete) any trace data linked to the user
handlers.__users.delete = function(data, callback){
    const phoneNumber = typeof(data.queryStringObject.phoneNumber) === "string" && data.queryStringObject.phoneNumber.trim().length == 10? data.queryStringObject.phoneNumber : false;
    if (phoneNumber) {

        const token = typeof(data.headers.token) === "string" ? data.headers.token : false
        //Verify that the given token is valid for the phoneNumber
        handlers.__tokens.verifyToken(token, phoneNumber, function(tokenIsValid){
            if (tokenIsValid){
                //Look Up the user
                __data.read("users", phoneNumber, function(err, userData){
                    if (!err && userData) {
                        __data.delete("users", phoneNumber, function(err){
                            if (!err) {
                                //Delete the checks associated with the user
                                const userChecks = typeof (userData.checks) === "object" && userData.checks instanceof Array ? userData.checks : [];
                                const checksToDelete = userChecks.length;
                                if (checksToDelete  > 0) {
                                    let checksDeleted = 0;
                                    let deletionErrors = false;
                                    userChecks.forEach(function(checkId){
                                        __data.delete("checks", checkId, function(e){
                                            if (e) {
                                                deletionErrors = true;
                                            } 
                                            checksDeleted++;
                                            if (checksDeleted === checksToDelete){
                                                if (!deletionErrors) {
                                                    callback(200);
                                                } else {
                                                    callback(500,{"Error": "Error encountered while deleting checks related to user, so not all checks may have been deleted"})
                                                }
                                            }
                                        })
                                        
                                    })  
                                } 
                            } else {
                                callback(500, {"Error": "Could not delete specified user"})
                            }
                        })
                        
                    } else {
                        callback(400, {"Error":"Missing required fields"})
                    }
                })
            } else {
                callback(403, {"Error": "Missing required token field in header or token is invalid"})
            }
        })

    } else {
        callback(400, {"Error": "Missing required fields"})
    }
}

//Tokens
handler.tokens = function(data, callback){
    const acceptableMethods = ["get", "put", "post", "delete"];
    if (acceptableMethods.indexOf(data.method) > -1) {
        console.log(data.method)
        handlers.__tokens[data.method](data, callback);
    } else {
        callback(405);
    }
}

//Containers for all tokens method calls
handlers.__tokens = {};


handlers.__tokens.get = function(data, callback){
    const id = typeof (data.queryStringObject.id) === "string" && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        __data.read("tokens", id, function(err, tokenData){
            if (!err && tokenData) {
                callback(200, tokenData);
            } else {
                callback(404)
            }
        })
    } else {
        callback(400, {"Error":"Missing required fields"})
    }
}

handlers.__tokens.post = function(data, callback){
    const phoneNumber = typeof (data.payload.phoneNumber) === "string" && data.payload.phoneNumber.trim().length === 13 ? data.payload.phoneNumber.trim() : false;
    const password = typeof (data.payload.password) === "string" && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    if (password && phoneNumber) {
        __data.read("users",phoneNumber, function(err, userData){
            if (!err && userData) {
                const hashedPassword = helpers.hash(password);
                if (hashedPassword === userData.password) {
                    const tokenId = helpers.createRandomString(20);
                    const expires = Date.now() + 1000 * 60 * 60;
                    const tokenObj = {
                        "phoneNumber": phoneNumber,
                        "tokenId": tokenId,
                        "expires": expires
                    }
                    __data.create("tokens", tokenId, tokenObj, function(err){
                        if (!err) {
                            callback(200, tokenObj);
                        } else {
                            callback(500, {"Error":"Could not create token"});
                        }
                    })

                } else {
                    callback(400, {"Error":"Password did not match user's stored password"})
                }
            } else {
                callback(400, {"Error":"Could not find the specified user"});
            }
        });
    } else {
        callback(400, {"Error": "Missing required fields"})
    }
}

handlers.__tokens.put = function(data, callback){
    const id = typeof (data.payload.id) === "string" && data.payload.id.trim().length === 20 ? data.payload.id.trim() : false;
    const extend = typeof (data.payload.extend) === "boolean" && data.payload.extend === true ? true : false;
    if (id && extend) {
        __data.read("tokens", id, function(err,tokenData){
            if (!err && tokenData) {
                if (tokenData.expires > Date.now()) {
                    tokenData.expires = Date.now() + 1000 * 60 * 60;
                    __data.update("tokens", id, tokenData, function(error){
                        if (!error) {
                            callback(200);
                        } else {
                            callback(500, {"Error":"Could not extend the token, the token expiration"})
                        }
                    })
                } else {
                    callback(400, {"Error":"Token has already expired and can not be extended"})
                }
            } else {
                callback(400, {"Error":"Specified token does not exist"})
            }
        })
    } else {
        callback(400, {"Error": "Missing required fields"})
    }
}

handlers.__tokens.delete = function(data, callback){
    const id = typeof (data.queryStringObject.id) === "string" && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        __data.read("tokens", id, function(err,tokenData){
            if (!err && tokenData) {
                __data.delete("tokens", id, function(error){
                    if (!error) {
                        callback(200);
                    } else {
                        callback(500, {"Error":"Could not delete the specified token"})
                    }
                })
            } else {
                callback(400, {"Error":"Could not find the specified user"})
            }
        })
    } else {
        callback(400, {"Error":"Missing required fields"})
    }
}

handlers.__tokens.verifyToken = function(id, phoneNumber,callback){
    if (id && phoneNumber) {
        __data.read("tokens", id, function(err,tokenData){
            if (!err && tokenData) {
                if (tokenData.phoneNumber === phoneNumber && tokenData.expires > Date.now()) {
                    callback(true);
                } else {
                    callback(false)
                }
            } else {
                callback(false)
            }
        })
    } else {
        callback(false)
    }
}

//Checks
handler.checks = function(data, callback){
    const acceptableMethods = ["get", "put", "post", "delete"];
    if (acceptableMethods.indexOf(data.method) > -1) {
        console.log(data.method)
        handlers.__checks[data.method](data, callback);
    } else {
        callback(405);
    }
}

//Containers for all checks method calls
handlers.__checks = {};

//Checks - post
//Required data - protocol, url, method, statusCodes, timeoutSeconds
//Optional data - none
handlers.__checks.post = function(data, callback){
    const protocol = typeof (data.payload.protocol) === "string" && ["http", "https"].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    const url = typeof (data.payload.url) === "string" && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    const method = typeof (data.payload.method) === "string" && ["get", "put", "post", "delete"].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    const statusCodes = typeof (data.payload.statusCodes) === "object" && data.payload.statusCodes instanceof Array ? data.payload.statusCodes : false;
    const timeoutSeconds = typeof (data.payload.timeoutSeconds) === "number" && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;
    
    if (protocol && url && method && statusCodes && timeoutSeconds) {
        const token = typeof (data.headers.token) === "string" ? data.headers.token : false;
        if (token) {
            __data.read("tokens", token, function (err, tokenData) {
                if (!err && tokenData) {
                    const phoneNumber = tokenData.phoneNumber;
                    __data.read("users", phoneNumber, function(err, userData){
                        if (!err && userData) {
                            const userChecks = typeof (userData.checks) === "object" && userData.checks instanceof Array ? userData.checks : [];
                            if (userChecks.length < config.maxChecks) {
                                const checkId = helpers.createRandomString(20);
                                let checkObj = {
                                    "id": checkId,
                                    "phoneNumber": phoneNumber,
                                    "method": method,
                                    "protocol": protocol,
                                    "url": url,
                                    "statusCodes": statusCodes,
                                    "timeoutSeconds": timeoutSeconds
                                }

                                __data.create("checks", checkId, checkObj, function(error){
                                    if (!error) {
                                        userData.checks = userChecks;
                                        userData.checks.push(checkId);
                                        __data.update("users", phoneNumber, userData, function(err){
                                            if (!err) {
                                                callback(200, checkObj);
                                            } else {
                                                callback(500, {"Error":"Could not update user with the new check"})
                                            }
                                        })
                                    } else {
                                        callback(500, {"Error":"Could not create new check"})
                                    }
                                })
                            } else {
                                callback(400, {"Error":"The user has already hit the maximum number of checks ( "+config.maxChecks+" )"});
                            }
                        } else {
                            callback(403)
                        }
                    })
                } else {
                    callback(403)
                }
            });
        } else {
            callback(403);
        }
    } else {
        callback(400, {"Error":"Missing required input or inputs are invalid"})
    }
}

//Checks- get
//Required inputs - checkId
//Optional data - none
handlers.__checks.get = function(data, callback){
    const checkId = typeof(data.queryStringObject.id) === "string" && data.queryStringObject.id.trim().length == 20? data.queryStringObject.id.trim() : false;
    if (checkId) {
        //Look up the check folder 
        __data.read("checks", checkId, function(err, checkData){
            if (!err && checkData) {
                const token = typeof(data.headers.token) === "string" ? data.headers.token : false;
                //Verify that the given token is valid for the phoneNumber
                handlers.__tokens.verifyToken(token, checkData.phoneNumber, function(tokenIsValid){
                    if (tokenIsValid){
                        console.log(tokenIsValid);
                        callback(200, checkData);
                    } else {
                        callback(403)
                    }
                })
            } else{
                callback(404);
            }
        })  
    } else {
        callback(400, {"Error": "Missing required fields"})
    }
}

//Checks - put
//Required inputs - checkId
//Optional data - protocol, url, method, successCodes & timeoutSeconds (one of these must be specified)
handlers.__checks.put = function(data, callback){
    //Required field
    const checkId = typeof (data.payload.checkId) === "string" && data.payload.checkId.trim().length === 20 ? data.payload.checkId.trim() : false;

    if (checkId) {
        //Optional feilds to update
        const protocol = typeof (data.payload.protocol) === "string" && ["http", "https"].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
        const url = typeof (data.payload.url) === "string" && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
        const method = typeof (data.payload.method) === "string" && ["get", "put", "post", "delete"].indexOf(data.payload.method) > -1 ? data.payload.method : false;
        const statusCodes = typeof (data.payload.statusCodes) === "object" && data.payload.statusCodes instanceof Array ? data.payload.statusCodes : false;
        const timeoutSeconds = typeof (data.payload.timeoutSeconds) === "number" && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

        //Check if optional fields were provided
        if (protocol || url || method || statusCodes || timeoutSeconds) {
            //Look up the checks
            __data.read("checks", checkId, function(err, checkData){
                if (!err && checkData) {
                    const token = typeof(data.headers.token) === "string" ? data.headers.token : false
                    //Verify that the given token is valid for the phoneNumber
                    handlers.__tokens.verifyToken(token, checkData.phoneNumber, function(tokenIsValid){
                        if (tokenIsValid){
                            if(protocol){
                                checkData.protocol = protocol;
                            }
                            if(url){
                                checkData.url = url;
                            }
                            if (method){
                                checkData.method = method;
                            }
                            if (statusCodes){
                                checkData.statusCodes = statusCodes;
                            }
                            if (timeoutSeconds){
                                checkData.timeoutSeconds = timeoutSeconds;
                            }
                            //Update and store the new updates
                            __data.update("checks", checkId, checkData, function(error){
                                if (!error) {
                                    callback(200);
                                } else {
                                    callback(500, {"Error":"Could not update the check "})
                                }
                            })
                        } else{
                            callback(403);
                        }
                    })
                } else {
                    callback(400, {"Error":"Check ID do not exist"})
                }
            })
        } else {
            callback(400, {"Error":"Missing input fields"})
        }
    } else {
        callback(400, {"Error": "Missing required fields"})
    }
    
}

//Checks - delete
//Required fields - checkId
//Optional data - none
handlers.__checks.delete = function(data, callback){
    const checkId = typeof(data.queryStringObject.checkId) === "string" && data.queryStringObject.checkId.trim().length == 20? data.queryStringObject.checkId.trim() : false;
    if (checkId){
        //Lookup the Checks
        __data.read("checks", checkId, function(err, checkData){
            if (!err && checkData) {
                const token = typeof(data.headers.token) === "string" ? data.headers.token : false
                //Verify that the given token is valid for the phoneNumber
                handlers.__tokens.verifyToken(token, checkData.phoneNumber, function(tokenIsValid){
                    if (tokenIsValid){
                        //Look Up the user
                        __data.read("users", checkData.phoneNumber, function(error, userData){
                            if (!error && userData) {
                                const userChecks = typeof (userData.checks) === "object" && userData.checks instanceof Array ? userData.checks : [];

                                //Remove the delete check from the list of checks
                                const checkPosition = userChecks.indexOf(checkId);
                                if (checkPosition > -1) {
                                    userChecks.splice(checkPosition, 1);
                                    __data.update("users", checkData.phoneNumber, userData, function(e){
                                        if (!e) {
                                            callback(200);
                                        } else {
                                            callback(500,{"Error": "Couldn't update user details"})
                                        }
                                    })
                                } else {
                                    callback(500, {"Error": "Could not find the check on the user's object, so could not remove the check"})
                                }

                            } else {
                                callback(400, {"Error":"Could not find user who created the check, so user object can't be updated"})
                            }
                        })
                    } else {
                        callback(403);
                    }
                })
            } else {
                callback(400, {"Error":"Check ID do not exist"})
            }
        })

        

    } else {
        callback(400, {"Error": "Missing required fields"})
    }
}


handler.ping = function(data, callback){
    callback(200);
}

handler.notfound = function(data, callback){
    callback(404)
}

//Export the module
module.exports = handler;