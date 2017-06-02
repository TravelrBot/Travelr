"use strict";
exports.__esModule = true;
var builder = require("botbuilder");
var restify = require("restify");
var request = require("request");
var googleMaps = require("@google/maps");
var process = require("process");
var path = require("path");
var googleMapsClient = googleMaps.createClient({
    key: process.env.GOOGLE_MAPS_KEY
});

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: '',
    appPassword:''
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector);
bot.dialog("/", [
    function (session, response, next) {
        session.send(session.message.source);
        next();
    },
    function(session, response, next)
    {
        session.send(session.message.source);
    }
]);