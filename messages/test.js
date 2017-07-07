"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var builder = require("botbuilder");
const restify = require("restify");
const process = require("process");
var server = restify.createServer();
var azure = require('azure-storage');
var botbuilder_azure = require("botbuilder-azure");
var map_builder = require("./map_builder")

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3979, function () {
    console.log('%s listening to %s', server.name, server.url);
});
var connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});
server.post('/api/messages', connector.listen());
var tableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
var AzureTableClient = new botbuilder_azure.AzureTableClient("BotStorage", "travelrbotc4g2ai", 'cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==');
var UserTable = new botbuilder_azure.AzureBotStorage({ gzipData: false }, AzureTableClient);
var bot = new builder.UniversalBot(connector).set('storage', UserTable);
var entGen = azure.TableUtilities.entityGenerator;
var time = Date.now();
var now = time.toString();


bot.dialog("/", [
    (session) =>
    {
        session.send(new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .addAttachment(new builder.HeroCard(session)
                .images([new builder.CardImage.create(session, map_builder.map_image_location_builder(32.7767, -96.7970))])
                .title("Dallas")
                .text("Hello from Dallas!")
                .buttons([new builder.CardAction.imBack(session, "Dallas", "Dallas")]))
            .addAttachment(new builder.HeroCard(session)
                .images([new builder.CardImage.create(session, map_builder.map_image_location_builder(30.2672, -97.7431))])
                .title("Austin"))
            .addAttachment(new builder.HeroCard(session)
                .images([new builder.CardImage.create(session, map_builder.map_image_location_builder(39.7392, -104.9903))])
                .title("Denver"))
        )
    },
    (session, results, next) =>
    {
        console.log(results);
        session.send("You picked!")
    }
])




























/*
function PhoneStrip(phone) {
    var finalPhone = '';
    for (var index = 0; index < phone.length; index++) {
        if (phone[index] == "-") {
            continue;
        }
        else {
            finalPhone += phone[index];
        }
    }
    return finalPhone;
}
bot.dialog("/", [
    function (session, args, next) {
        console.log("Getting choice");
        builder.Prompts.choice(session, "Welcome to the account settings! Would you like to 'Sign Up', 'Login', 'Edit', or 'Cancel'?", ['Sign Up', 'Login', 'Edit', 'Cancel']);
    },
    function (session, results, next) {
        console.log("Directing the choice");
        if (results.response.index == 0) {
            session.beginDialog('/signUp');
        }
        else if (results.response.index == 1) {
            session.beginDialog('/login');
        }
        else if (results.response.index == 2) {
            session.beginDialog('/edit');
        }
        else if (results.resposne.index == 3) {
            session.endDialog("Okay returning you to the main menu!");
        }
    },
    function (session, results, next) {
        if (results.resumed == builder.ResumeReason.completed) {
            session.replaceDialog('/');
        }
    }
]);
bot.dialog('/signUp', [
    function (session, args, next) {
        console.log("In the sign up dialog");
        console.log("Getting the users phone number");
        builder.Prompts.text(session, "Welcome to the sign up dialog! What is your phone number? Your phone number will become your ID.");
    },
    function (session, results, next) {
        console.log("Getting the user's pin");
        var phone = results.response.trim();
        var finalPhone = PhoneStrip(phone);
        session.userData.phone = finalPhone;
        builder.Prompts.text(session, "Great! Now we just need a custom pin. It can be of any length or combination!");
    },
    function (session, results, next) {
        console.log("Asking for add to favorites");
        session.userData.pin = results.response;
        builder.Prompts.choice(session, "Would you like to add your favorite places?", ["Yes", "No"]);
    },
    function (session, results, next) {
        if (results.response.index == 0) {
            session.send("Awesome, starting the 'Add Favorites' dialog!");
            console.log("starting the add favorites dialog!");
            var response = session.beginDialog('/addFavorites');
        }
        else {
            next();
        }
    },
    function (session, args, next) {
        console.log("Building the user's account");
        // build the account
        // Check to see if favorite locations have been added 
        var FavoriteLocations = {};
        if (session.userData.favoriteLocations) {
            var locationsObject = session.userData.favoriteLocations;
            for (var key in locationsObject) {
                FavoriteLocations[key.toString()] = locationsObject[key.toString()];
            }
        }
        var VisitedLocations = (_a = {},
            _a[now] = {},
            _a);
        var Entity = {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Favorite_Locations: entGen.String(JSON.stringify(FavoriteLocations)),
            Visited_Locations: entGen.String(JSON.stringify(VisitedLocations))
        };
        tableService.insertOrReplaceEntity("User", Entity, function (error, result, response) {
            if (!error) {
                console.log("Person added to Table");
                session.userData.favoriteLocations = FavoriteLocations;
                session.endDialog("Your account has been updated. And you have been signed in!");
            }
            else {
                console.log("There was an error adding the person: \n\n");
                session.endDialog("There was an error updating your account");
                console.log(error);
            }
        });
        var _a;
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
        session.dialogData.tempFavoriteLocationAddress = results.response;
        builder.Prompts.choice(session, "You said your location name was '" + session.dialogData.tempFavoriteLocationName + " and the address was " + results.response + ". Is that correct?'", ["Yes", "No"]);
    },
    function (session, results, next) {
        if (results.response.index == 0) {
            // add the information to the array of favorite locations
            var tempFavoriteLocationName = session.dialogData.tempFavoriteLocationName;
            var tempFavoriteLocationAddress = session.dialogData.tempFavoriteLocationAddress;
            // Check to see if the user already has favorites
            var FavoriteLocation = session.userData.favoriteLocations;
            if (!FavoriteLocation) {
                console.log("There are no favorite locations");
                var FavoriteLocation_1 = {};
                FavoriteLocation_1[tempFavoriteLocationName] = tempFavoriteLocationAddress;
                // Add the location to the favorite
                session.userData.favoriteLocations = FavoriteLocation_1;
            }
            else {
                console.log("Add a new favorite location");
                FavoriteLocation[tempFavoriteLocationName] = tempFavoriteLocationAddress;
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
            session.endDialog("Okay, updating your account!");
        }
    }
]);
bot.dialog('/removeFavorites', [
    function (session, results, next) {
        // Add the favorites to the string array
        var favorites = ["Cancel"];
        console.log(session.userData.favoriteLocations);
        var favoriteLocations = session.userData.favoriteLocations;
        for (var key in favoriteLocations) {
            favorites.push(key);
        }
        builder.Prompts.choice(session, "Which location would you like to remove from favorites?", favorites);
    },
    function (session, results, next) {
        var favoriteLocations = session.userData.favoriteLocations;
        for (var key in favoriteLocations) {
            if (key == results.response.entity) {
                delete favoriteLocations[key];
            }
        }
        // upload the new favorite locations to userData
        session.userData.favoriteLocations = favoriteLocations;
        session.endDialog();
    }
]);
bot.dialog('/login', [
    function (session, results, next) {
        builder.Prompts.text(session, "Welcome to the 'Login Dialog'. What is your Phone Number?");
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.phone = PhoneStrip(results.response);
        }
        ;
        builder.Prompts.text(session, "What is your pin?");
    },
    function (session, results, next) {
        session.dialogData.pin = results.response;
        console.log("Getting the user from the table");
        var query = new azure.TableQuery()
            .where('PartitionKey eq ?', session.dialogData.phone)
            .and("RowKey eq ?", session.dialogData.pin);
        tableService.queryEntities("User", query, null, function (error, result, response) {
            if (error) {
                console.log("There was an error getting the user.");
                console.log(error);
                builder.Prompts.text(session, "There was an unknown error finding your account. Would you like to try again?", ["Yes", "No"]);
            }
            else {
                console.log("No Error!");
                // Check to see if the user was found
                if (result.entries.length == 0) {
                    builder.Prompts.choice(session, "We could not find your account. Would you like to try again?", ["Yes", "No"]);
                }
                else
                {
                    // Get all of the locations and restore the account
                    console.log(result.entries[0].Favorite_Locations._);
                    session.userData.favoriteLocations = JSON.parse(result.entries[0].Favorite_Locations._);
                    session.userData.phone = session.dialogData.phone;
                    session.userData.pin = session.dialogData.pin;
                    session.endDialog("We found your account! You are now logged in. ");
                }
            }
        });
    },
    function (session, results, next) {
        if (results.response.index == 0) {
            session.replaceDialog('/login');
        }
        else {
            session.endDialog("Okay I am returning you to the previous dialog.");
        }
    }
]);
bot.dialog('/edit', [
    function (session, args, next) {
        session.send("Welcome to the 'Account Edit Dialog! We need to make sure you are logged in in first!'");
        // check to see if there is user data
        // Go to the next step in the waterfall
        if (session.userData.phone && session.userData.pin) {
            next();
        }
        else {
            session.beginDialog("/login");
        }
    },
    function (session, results, next) {
        builder.Prompts.choice(session, "Awesome, we have your info. What would you like to do next?", ["Remove Favorites", "Add Favorites", "Cancel"]);
    },
    function (session, results, next) {
        if (results.response.index == 0) {
            session.beginDialog('/removeFavorites');
        }
        else if (results.response.index == 1) {
            session.beginDialog('/addFavorites');
        }
        else {
            session.endDialog("Okay returning you to account settings home.");
        }
    },
    function (session, result, next) {
        // Create the entity 
        var newUser = {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Favorite_Locations: entGen.String(JSON.stringify(session.userData.favoriteLocations))
        };
        // Update the database
        tableService.mergeEntity("User", newUser, function (error, results, response) {
            if (error) {
                console.log(error);
                session.send("There was an error when updating your acocunt.");
                session.replaceDialog('/edit');
            }
            else {
                console.log(results);
                session.send("Your account was successfully updated!");
                session.replaceDialog("/edit");
            }
        });
    }
]);

*/
