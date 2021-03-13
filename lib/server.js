/**
 * Server related task
 * 
 */
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require("./config");
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const util = require('util');
const debug = util.debuglog("server");

// helpers.sendTwilioSms("2348094911826", "Hi", function(e){
//     console.log("this was the error", e);
// })

//Instantiate a server module object
const server = {};

//Start HTTP Server
server.httpServer = http.createServer((req, res) => {
    server.unifiedServer(req, res);
});

server.httpsServerOptions = {
    "key": fs.readFileSync(path.join(__dirname, "/../https/myCA.key")),
    "passphrase": "1234567890"
}

//Start HTTPS Server
server.httpsServer = https.createServer(server.httpsServerOptions,(req, res) => {
    server.unifiedServer(req, res);
})


server.unifiedServer = (req, res) => {

    //Get the URL and parse it
    const parsedUrl = url.parse(req.url, true);

    //retrieving the queryobject from the parsed url
    const queryStringObject = parsedUrl.query

    //retrieving the header object from the request object
    const headers = req.headers

    //retrieving the path from the request
    const reqPath = parsedUrl.pathname;

    //trimming the path name
    const trimmedPath = reqPath.replace(/^\/+|\/+$/g,'');

    //get the method of request
    const method = req.method.toLowerCase();

    let buffer = ""
    const decoder = new StringDecoder('utf-8');

    req.on('data', function(data){
        buffer += decoder.write(data);
    })

    req.on('end', function(){
        buffer += decoder.end();

        var data = {
            "trimmedPath": trimmedPath,
            "queryStringObject": queryStringObject,
            "method": method,
            "headers": headers,
            "payload": helpers.parsedJsonToObject(buffer),
        }

        const chooseHandler = typeof(router[trimmedPath]) !== "undefined"? router[trimmedPath]: handler.notfound;

        chooseHandler(data, function (statusCode, payload) {
            payload = typeof(payload) === "object" ? payload: {};

            statusCode = typeof(statusCode) === "number" ? statusCode: 200;

            const payloadString = JSON.stringify(payload);
            
            res.setHeader('Content-Type',"application/json");
            res.writeHead(statusCode);
            res.end(payloadString);

            //log the request path
            //If status code equals 200, print green otherwise red
            if (statusCode === 200){
                debug('\x1b[32m%s\x1b[0m',method.toUpperCase()+" /" +trimmedPath+ ' ' +statusCode);
            } else {
                debug('\x1b[31m%s\x1b[0m',method.toUpperCase()+" /" +trimmedPath+ ' ' +statusCode);
            }
        })        
    })

    const router = {
        "ping": handlers.ping,
        "users": handlers.users,
        "tokens": handlers.tokens,
        "checks": handlers.checks
    };

}

//Instantiate the server init function
server.init = function(){
    //Start the HTTP server
    server.httpServer.listen(config.httpPort, () => {
        console.log('\x1b[36m%s\x1b[0m',"Server listening on port on " +config.httpPort);
        // console.log("Server listening on port on " +config.httpPort);
    })
    //Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, () => {
        console.log('\x1b[35m%s\x1b[0m',"Server listening on port on " +config.httpsPort);
    })
}

module.exports = server;
