"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var builder = require("botbuilder");
const restify = require("restify");
const process = require("process");
var server = restify.createServer();
var azure = require('azure-storage');

server.listen(process.env.port || process.env.PORT || 3979, function () {
    console.log('%s listening to %s', server.name, server.url);
});
var connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});
server.post('/api/messages', connector.listen());
var bot = new builder.UniversalBot(connector);
var tableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
var entGen = azure.TableUtilities.entityGenerator;
var time = Date.now();
var now = time.toString();
bot.dialog("/", [
    function (session, args, next) {
        console.log("Getting choice");
        builder.Prompts.choice(session, "Welcome to the account login! Would you like to 'Sign Up', 'Login', 'Edit', or 'Cancel'?", ['Sign Up', 'Login', 'Edit', 'Cancel']);
    },
    function (session, results, next) {
        console.log("Directing the choice");
        if (results.response.index == 0) {
            session.beginDialog('/signUp');
        }
        else if (results.response.index == 1) {
        }
        else if (results.response.index == 2) {
        }
        else if (results.resposne.index == 3) {
        }
    },
    function (session, results, next) {
        session.userData.pin = results.response;
        console.log("Getting the user from the table");
        var query = new azure.TableQuery()
            .where('PartitionKey eq ?', session.userData.phone)
            .and("RowKey eq ?", session.userData.pin);
        tableService.queryEntities("User", query, null, function (error, result, response) {
            if (error) {
                console.log("There was an error getting the user.");
                console.log(error);
            }
            else {
                console.log("User found!");
                console.log(response.body);
                console.log(result.entries);
            }
        });
    }
]);
bot.dialog('/signUp', [
    function (session, args, next) {
        builder.Prompts.text(session, "Welcome to the sign up dialog! What is your phone number? Your phone number will become your ID.");
    },
    function (session, results, next) {
        var phone = results.response.trim();
        var finalPhone = "";
        for (var index = 0; index < phone.length; index++) {
            if (phone[index] == "-") {
                continue;
            }
            else {
                finalPhone += phone[index];
            }
        }
        session.userData.phone = finalPhone;
        builder.Prompts.text(session, "Great! Now we just need a custom pin. It can be of any length or combination!");
    },
    function (session, results, next) {
        session.userData.pin = results.response;
        builder.Prompts.choice(session, "Would you like to add your favorite places?", ["Yes", "No"]);
    },
    function (session, results, next) {
        if (results.response.index == 0) {
            session.send("Awesome, starting the 'Add Favorites' dialog!");
            session.beginDialog('/addFavorites');
        }
        console.log("Building the account");
        // build the account
        var UserIDs = {
            ids: [session.message.user.id]
        };
        // Check to see if favorite locations have been added 
        var FavoriteLocations = {};
        if (session.userData.favoriteLocations != undefined) {
            var locationsObject = session.userData.favoriteLocations;
            for (var key in locationsObject) {
                FavoriteLocations[key.toString()] = locationsObject[key.toString()];
            }
        }
        var VisitedLocations = {
            now: {}
        };
        var Entity = {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Ids: entGen.String(JSON.stringify(UserIDs)),
            Favorite_Locations: entGen.String(JSON.stringify(FavoriteLocations)),
            Visited_Locations: entGen.String(JSON.stringify(VisitedLocations))
        };
        tableService.insertOrReplaceEntity("User", Entity, function (error, result, response) {
            if (!error) {
                console.log("Person added to Table");
                next();
            }
            else {
                console.log("There was an error adding the person: \n\n");
                console.log(error);
            }
        });
    }
]);
bot.dialog('/addFavorites', [
    function (session, args, next) {
        builder.Prompts.text(session, "What is the name of your favorite location? E.g. 'Work', or 'Home'");
    },
    function (session, results, next) {
        session.dialogData.tempFavoriteLocationName = results.response;
        builder.Prompts.text(session, "What is the address for that location? E.g. '2200 Main Street Austin, Texas' or '15 and Broadway New York, New York'");
    },
    function (session, results, next) {
        session.userData.tempFavoriteLocationAddress = results.response;
        builder.Prompts.choice(session, "You said your location name was '" + session.dialogData.tempFavoriteLocationName + " and the address was " + results.response + ". Is that correct?'", ["Yes", "No"]);
    },
    function (session, results, next) {
        if (results.response.index == 0) {
            // add the information to the array of favorite locations
            var tempFavoriteLocationName = session.userData.tempFavoriteLocationName;
            var tempFavoriteLocationAddress = session.userData.tempFavoriteLocationAddress;
            // Check to see if the user already has favorites
            var FavoriteLocation = session.userData.favoriteLocations;
            if (FavoriteLocation == undefined) {
                var FavoriteLocation_1 = {
                    tempFavoriteLocationName: tempFavoriteLocationAddress
                };
                // Add the location to the favorite
                session.userData.favoriteLocations = FavoriteLocation_1;
            }
            else {
                FavoriteLocation.tempFavoriteLocationName = tempFavoriteLocationAddress;
                session.userData.favoriteLocations = FavoriteLocation;
            }
            builder.Prompts.choice(session, "Would you like to add another favorite?", ["Yes", "No"]);
        }
        else if (results.response.index == 1) {
            session.send("Okay we will start over");
            session.replaceDialog("/addFavorites");
        }
    },
    function (session, results, next) {
        if (results.response.index == 0) {
            session.replaceDialog('/addFavorites');
        }
        else if (results.response.index == 1) {
            session.endDialog("Okay, returning back to the account dialog!");
        }
    }
]);
