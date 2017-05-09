import * as builder from "botbuilder";
import * as restify from "restify";
import * as request from "request";
import * as Uber from "node-uber";
import * as googleMaps from "@google/maps";

let googleMapsClient = googleMaps.createClient({
    key:process.env.GOOGLE_MAPS_KEY
});

// Setup Restify Server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat bot 
let connector: builder.ChatConnector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

let bot: builder.UniversalBot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Serve a static web page
server.get(/.*/, restify.serveStatic({
	'directory': '.',
	'default': 'Index.html'})
);

function HtmlParse (html: string): string 
{
    html += " ";
    let html_array: string[] = html.split("");
    let html_return: string = '';

    // loop through each word 
    for (let i: number = 0; i < html_array.length; i+= 1)
    {
        if (html_array[i] == "<")
        {
            while (html_array[i] != '>' || html_array[i+1] == "<")
            {
                i++;
            }

            i++
        }

        html_return += html_array[i];
    }

    return (html_return.replace(/  /g, " ").trim())
}

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', new builder.IntentDialog()
    .matches('lyft', '/lyft')
    .matches('uber', '/uber')
    .matches('transit', '/transit')
    .onDefault('/waterfall'));

bot.dialog('/waterfall', [

    // send the intro
    function (session: builder.Session, args: any, next): void{
        session.send("Hello and welcome to Travelr! Just tell us where you are going and we will get you there as quickly as possible!");
        next();
    },

    // get the user's starting location
    function(session: builder.Session): void{
        builder.Prompts.text(session, "What is your starting location?");
    },

//=========================================================
// Google Geolocation
//=========================================================

    // save the result 
    function (session: builder.Session, result, next): void
    {
        let lat: any;
        let long: any;

        session.userData.start = result.response;

        // call the google maps function to get the coordinates 
        googleMapsClient.geocode(
            {
                address: session.userData.start
            },
            function (err, response: string)
            {
                if (!err)
                {
                    
                }
            }
        )
    }])