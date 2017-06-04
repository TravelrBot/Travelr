"use strict";
exports.__esModule = true;
var builder = require("botbuilder");
var restify = require("restify");
var process = require("process");
// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});
// Listen for messages from users 
server.post('/api/messages', connector.listen());
var bot = new builder.UniversalBot(connector);
bot.dialog("/", [
    function (session, args, next) {
        session.send(session.message.source);
        session.beginDialog("/index");
    }
]).customAction({ matches: /^custom/i, onSelectAction: function (session, args) {
        session.clearDialogStack();
        session.beginDialog('/test');
    }
});
bot.dialog('/test', [
    function (session) {
        builder.Prompts.confirm(session, "Do you want to restart?");
    },
    function (session, args, next) {
        console.log(args.response);
    }
]);
bot.dialog("/index", [
    function (session, args, next) {
        session.send("Hello world");
        next();
    },
    function (session, args, next) {
        builder.Prompts.confirm(session, "Want to continue?");
    }
]);
