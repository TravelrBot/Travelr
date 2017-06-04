"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder = require("botbuilder");
const restify = require("restify");
const process = require("process");
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
var connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});
server.post('/api/messages', connector.listen());
var bot = new builder.UniversalBot(connector);
bot.dialog("/", [
    function (session, args, next) {
        session.send(session.message.source);
        session.beginDialog("/index");
    }
]).customAction({ matches: /^custom/i, onSelectAction: (session, args) => {
        session.clearDialogStack();
        session.beginDialog('/test');
    }
});
bot.dialog('/test', [
    (session) => {
        builder.Prompts.confirm(session, "Do you want to restart?");
    },
    (session, args, next) => {
        console.log(args.response);
    }
]);
bot.dialog("/index", [
    (session, args, next) => {
        session.send("Hello world");
        next();
    },
    (session, args, next) => {
        builder.Prompts.confirm(session, "Want to continue?");
    }
]);
