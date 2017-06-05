import * as builder from "botbuilder";
import * as restify from "restify";
import * as request from "request";
import * as googleMaps from "@google/maps";
import {Uber} from "./uber";
import {Lyft} from "./lyft";
import {Results} from "./results";
import {Transit} from "./transit";
import * as process from "process";
import * as path from "path";

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
    function(session: builder.Session, args, next: any)
    {
        
        session.send(session.message.source);
        session.beginDialog("/index");
    }
]).customAction({matches: /^custom/i, onSelectAction: (session, args) => 
    {
        session.clearDialogStack();
        session.beginDialog('/test');
    }
})

bot.dialog('/test', [
    (session) =>
    {
        builder.Prompts.confirm(session, "Do you want to restart?");
    },
    (session, args: builder.IPromptConfirmResult, next) =>
    {
        console.log(args.response);
    }
])

bot.dialog("/index", [
    (session, args, next) =>
    {
        session.send("Hello world");
        next()
    },

    (session, args, next) =>
    {
        builder.Prompts.confirm(session, "Want to continue?");
    }

])