"use strict";
exports.__esModule = true;
var builder = require("botbuilder");
var restify = require("restify");
var request = require("request");
var googleMaps = require("@google/maps");
var process = require("process");
var path = require("path");
var botbuilder_azure = require("botbuilder-azure");
var azureStorage = require('azure-storage');
var map_builder = require('./map_builder')

//=========================================================
// Google Maps Configure
//=========================================================
var googleMapsClient = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4' //process.env.GOOGLE_MAPS_KEY
});
//=========================================================
// Connector Configuration
//=========================================================
var useEmulator = (process.env.NODE_ENV == 'development');
//useEmulator = true;
var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});
//=========================================================
// Storage Config
//=========================================================
var AzureTableClient = new botbuilder_azure.AzureTableClient("BotStorage", "travelrbotc4g2ai", 'cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==');
var UserTable = new botbuilder_azure.AzureBotStorage({ gzipData: false }, AzureTableClient);
var tableService = azureStorage.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
var entGen = azureStorage.TableUtilities.entityGenerator;
var time = Date.now();
var now = time.toString();
//=========================================================
// Bot Config
//=========================================================
var bot = new builder.UniversalBot(connector).set('storage', UserTable);
bot.localePath(path.join(__dirname, './locale'));
//=========================================================
// Universal Functions
//=========================================================
function HtmlParse(html) {
    html += " ";
    var html_array = html.split("");
    var html_return = '';
    // loop through each word 
    for (var i = 0; i < html_array.length; i += 1) {
        if (html_array[i] == "<") {
            while (html_array[i] != '>' || html_array[i + 1] == "<") {
                i++;
            }
            i++;
        }
        html_return += html_array[i];
    }
    return (html_return.replace(/  /g, " ").trim());
}
function LocationAddressFomater(address) {
    var addressSplit = address.split(" ");
    var formattedAddress = '';
    for (var index = 0; index < addressSplit.length; index++) {
        formattedAddress += (addressSplit[index]);
        if (index < addressSplit.length - 1) {
            formattedAddress += '%20';
        }
        else {
            // add nothing 
            continue;
        }
    }
    return formattedAddress;
}
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
//=========================================================
// Trigger Dialogs
//=========================================================
bot.dialog("/cancel", [
    function (session) {
        session.endConversation("Thank you for using Travelr!");
    }
]).triggerAction({
    confirmPrompt: "Are you sure you want to cancel?",
    matches: /^cancel/i,
});
bot.dialog("/recalculate", [
    function (session) {
        session.replaceDialog("/calculation");
    }
]).triggerAction({ confirmPrompt: "Are you sure you want to rerun?", matches: [/^rerun/i, /^recalculate/i] });
bot.dialog("/help", [
    function (session, args, next) {
        builder.Prompts.choice(session, "What would you like help with?", ["Company Info", "Commands", "Finished"]);
    },
    function (session, results, next) {
        if (results.response) {
            if (results.response.index == 0) {
                session.beginDialog('/info');
                next();
            }
            else if (results.response.index == 1) {
                session.beginDialog('/commands');
                next();
            }
            else {
                session.endDialog("Leaving the help dialog and returning you to your step!");
            }
        }
    },
    function (session) {
        session.replaceDialog('/help');
    }
]).triggerAction({
    matches: /^help/i,
    confirmPrompt: "Are you sure you want to launch the help dialog?",
    onSelectAction: function (session, args, next) {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        if (args.action) {
            session.beginDialog(args.action, args);
        }
        else {
            next();
        }
    }
});
bot.beginDialogAction("repeatOptions", "/options", {});
bot.beginDialogAction("endConversation", "/end");
//=========================================================
// Bots Dialogs
//=========================================================
bot.dialog('/', [
    function (session) {
        builder.Prompts.choice(session, "Hello and welcome to Travelr! What would you like to do?", ["Find Transportation", "Access Account", "Info/Help"]);
    },
    function (session, results, next) {
        if (results.response) {
            if (results.response.index == 0) {
                session.beginDialog("/main");
            }
            else if (results.response.index == 1) {
                session.beginDialog("/account");
            }
            else if (results.response.index == 2) {
                session.beginDialog("/help");
            }
        }
    },
    function (session) {
        session.replaceDialog('/');
    }
]);
bot.dialog('/main', [
    // send the intro
    function (session, args, next) {
        session.send("Great! We just need a few details to get you to your destination! You can say 'cancel' or 'restart' to redo your current step.");
        // Check to see if they are a registered user
        // If a known user with favorites launch the favorites dialog 
        if (session.userData.favoriteLocations) {
            console.log("Starting /favoriteLocations");
            session.replaceDialog("/favoriteLocations");
        }
        else {
            console.log("Starting /customLocations");
            session.replaceDialog("/customLocations");
        }
    }
]);
bot.dialog("/favoriteLocations", [
    // get the user's starting location
    function (session) {
        // Create a list of buttons for the favorites options
        var locationChoice = ["Custom"];
        // build the base location message for the favorites maps
        var locationMessage = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .addAttachment(new builder.HeroCard(session)
            .title("Custom")
            .subtitle("Select custom to enter a new address or location"));
        if (session.userData.phone && session.userData.pin) {
            var favoriteLocations = session.userData.favoriteLocations;
            for (var key in favoriteLocations) {
                // Add the key to the list of options
                locationChoice.push(key);
                // add an attachment to the hero card carousel
                locationMessage
                    .addAttachment(new builder.HeroCard(session)
                    .title(key)
                    .images([builder.CardImage.create(session, map_builder.map_image_location_builder(favoriteLocations[key].lat, favoriteLocations[key].long))]));
            }
        }
        session.send(locationMessage);
        builder.Prompts.choice(session, "You can enter a custom address or select one of your favorites", locationChoice);
    },
    function (session, results, next) {
        if (results.response) {
            if (results.response.index == 0) {
                builder.Prompts.text(session, "What is your starting location? (E.g. 22nd and Main Austin Texas or JKF Airport)");
            }
            else {
                // Find the key's pair 
                var favoriteLocations = session.userData.favoriteLocations;
                for (var key in favoriteLocations) {
                    if (key == results.response.entity) {
                        // set the user's start, start lat, and start long converstation data 
                        session.privateConversationData.start = favoriteLocations[key].address;
                        session.privateConversationData.start_lat = favoriteLocations[key].lat;
                        session.privateConversationData.start_long = favoriteLocations[key].long;
                        next();
                    }
                }
            }
        }
    },
    function (session, results, next) {
        // Check to see if the information has been recieved
        // The user chose a custom address
        if (results.response) {
            console.log("Adding the information for custom information.");
            // set the start address name
            session.privateConversationData.start = results.response;
            // set the starting lat and long 
            // call the google maps function to get the session.privateConversationData 
            googleMapsClient.geocode({ address: session.privateConversationData.start }, function (err, response) {
                if (!err) {
                    // Get and save the latitude
                    session.privateConversationData.start_lat = response.json.results[0].geometry.location.lat;
                    // get the longitude
                    session.privateConversationData.start_long = response.json.results[0].geometry.location.lng;
                    // send the location image in a message 
                    console.log("Building the location message");
                    var locationMessage_1 = map_builder.map_card_builder(session, response.json.results[0].geometry.location.lat, response.json.results[0].geometry.location.lng);
                    locationMessage_1.text("Here is your custom starting location. You can say say 'restart' to re-enter if it is wrong");
                    console.log("Sending the location image message");
                    session.send(locationMessage_1);
                }
                else {
                    // Call the error dialogue
                    console.log("There was an error getting your starting location");
                }
            });
        }
        console.log("Asking for destination");
        var locationChoice = ["Custom"];
        // build the base location message for the favorites maps
        var locationMessage = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .addAttachment(new builder.HeroCard(session)
            .title("Custom")
            .subtitle("Select custom to enter a new address or location"));
        //  Get the favorite locations
        var favoriteLocations = session.userData.favoriteLocations;
        // loop through each location and build out the buttons and hero card images
        for (var key in favoriteLocations) {
            locationChoice.push(key);
            // add an attachment to the hero card carousel
            locationMessage
                .addAttachment(new builder.HeroCard(session)
                .title(key)
                .images([builder.CardImage.create(session, map_builder.map_image_location_builder(favoriteLocations[key].lat, favoriteLocations[key].long))]));
        }
        session.send(locationMessage);
        builder.Prompts.choice(session, "Great! For your destination, you can enter a customer address or select one of your favorites", locationChoice);
    },
    function (session, results, next) {
        if (results.response) {
            if (results.response.index == 0) {
                builder.Prompts.text(session, "What is your destination? (E.g. 1600 Pennsylvania Avenue  or The Space Needle)");
            }
            else {
                // Find the key's pair 
                var favoriteLocations = session.userData.favoriteLocations;
                for (var key in favoriteLocations) {
                    if (key == results.response.entity) {
                        // set the user's end, end lat, and end long converstation data 
                        session.privateConversationData.end = favoriteLocations[key].address;
                        session.privateConversationData.end_lat = favoriteLocations[key].lat;
                        session.privateConversationData.end_long = favoriteLocations[key].long;
                        next();
                    }
                }
            }
        }
    },
    function (session, results, next) {
        // Check to see if the information has been recieved
        if (results.response) {
            session.privateConversationData.end = results.response;
            // Get and set the lat and long for the destiation
            googleMapsClient.geocode({ address: session.privateConversationData.end }, function (err, response) {
                if (!err) {
                    // get the latitutde
                    session.privateConversationData.end_lat = response.json.results[0].geometry.location.lat;
                    // get the longitude
                    session.privateConversationData.end_long = response.json.results[0].geometry.location.lng;
                    // send the location image in a message 
                    var locationMessage = map_builder.map_card_builder(session, response.json.results[0].geometry.location.lat, response.json.results[0].geometry.location.lng);
                    locationMessage.text("Here is your destination. Say 'restart' to re enter");
                    session.send(locationMessage);
                    // Start the next dialog
                    session.beginDialog("/preferences");
                }
                else {
                    // call the error dialogue
                    // Unable to determine location
                    console.log("There was an error in getting destination");
                }
            });
        }
        // Start the next dialog if a favorite was chosen
        session.beginDialog("/preferences");
    }
]).reloadAction("reloadLocations", "Getting your location again", {
    matches: [/^restart/i, /^start over/i, /^redo/i]
});
bot.dialog('/customLocations', [
    function (session) {
        builder.Prompts.text(session, "What is your starting location? (E.g. 22nd and Main Austin Texas or JKF Airport)");
    },
    function (session, results, next) {
        // Check to see if the information has been recieved
        if (results.response) {
            session.privateConversationData.start = results.response;
        }
        // set the starting lat and long 
        // call the google maps function to get the session.privateConversationData 
        googleMapsClient.geocode({ address: session.privateConversationData.start }, function (err, response) {
            if (!err) {
                // Get and save the latitude
                session.privateConversationData.start_lat = response.json.results[0].geometry.location.lat;
                // get the longitude
                session.privateConversationData.start_long = response.json.results[0].geometry.location.lng;
                // send the location image in a message 
                var locationMessage = map_builder.map_card_builder(session, response.json.results[0].geometry.location.lat, response.json.results[0].geometry.location.lng);
                locationMessage.text("Here is your starting location. Say 'restart' to re enter");
                session.send(locationMessage);
                console.log("Asking for destination");
                builder.Prompts.text(session, "What is your destination? (E.g. 1600 Pennsylvania Avenue  or The Space Needle)");
            }
            else {
                // Call the error dialogue
                console.log("There was an error getting your starting location");
            }
        });
    },
    function (session, results, next) {
        // Check to see if the information has been recieved
        if (results.response) {
            session.privateConversationData.end = results.response;
        }
        // Get and set the lat and long for the destiation
        googleMapsClient.geocode({ address: session.privateConversationData.end }, function (err, response) {
            if (!err) {
                // get the latitutde
                session.privateConversationData.end_lat = response.json.results[0].geometry.location.lat;
                // get the longitude
                session.privateConversationData.end_long = response.json.results[0].geometry.location.lng;
                // send the location image in a message 
                var locationMessage = map_builder.map_card_builder(session, response.json.results[0].geometry.location.lat, response.json.results[0].geometry.location.lng);
                locationMessage.text("Here is your destination. Say 'restart' to re enter");
                session.send(locationMessage);
                // Start the next dialog
                session.beginDialog("/preferences");
            }
            else {
                // call the error dialogue
                // Unable to determine location
                console.log("There was an error in getting destination");
            }
        });
    }
]);
bot.dialog('/preferences', [
    function (session, args, next) {
        console.log("Getting user preference");
        builder.Prompts.choice(session, "What is your preference on transportation", ["Value", "Time", "luxury"]);
    },
    // Save the perference 
    function (session, result, next) {
        console.log("Determining result");
        if (result.response) {
            switch (result.response.index) {
                case 0:
                    session.privateConversationData.perference = 0;
                    break;
                case 1:
                    session.privateConversationData.perference = 1;
                    break;
                case 2:
                    session.privateConversationData.perference = 2;
                default:
                    session.privateConversationData.perference = 0;
                    break;
            }
        }
        next();
    },
    // Ask about seating preferences
    function (session) {
        builder.Prompts.choice(session, "How many people do you have?", "1-2|3-4|5+");
    },
    function (session, result, next) {
        if (result.response) {
            switch (result.response.index) {
                case 0:
                    session.privateConversationData.group = 0;
                    break;
                case 1:
                    session.privateConversationData.group = 1;
                    break;
                case 2:
                    session.privateConversationData.group = 2;
                    break;
                default:
                    session.privateConversationData.group = 1;
                    break;
            }
        }
        // Go to the next step
        session.replaceDialog('/calculation');
    }
]).reloadAction("reloadPreferences", "Restarting Preference Gathering", {
    matches: [/^restart/i, /^start over/i]
});
bot.dialog('/calculation', [
    //=========================================================
    // Map information and Table Upload
    //=========================================================
    // Begin processing the information
    function (session, args, next) {
        session.send("Hold on while we get your results");
        // pull down the lats and long
        var start_lat = session.privateConversationData.start_lat;
        var end_lat = session.privateConversationData.end_lat;
        var start_long = session.privateConversationData.start_long;
        var end_long = session.privateConversationData.end_long;
        var start = session.privateConversationData.start;
        var end = session.privateConversationData.end;
        var phone = session.userData.phone;
        var pin = session.userData.pin;
        if (phone && pin) {
            // Get there account information for visted locations
            var query = new azureStorage.TableQuery()
                .select(["Visited_Locations"])
                .where('PartitionKey eq ?', phone)
                .and("RowKey eq ?", pin);
            // Execute the query 
            tableService.queryEntities("User", query, null, function (error, results, response) {
                if (error) {
                    console.log("Thee was an error seraching for the person");
                    console.log(error);
                }
                else {
                    console.log("No errors commiting query");
                    if (results.entries.length == 0) {
                        console.log("Person was not found");
                    }
                    else {
                        console.log(results.entries);
                        var visitedLocations = JSON.parse(results.entries[0].Visited_Locations._);
                        visitedLocations[now] =
                            {
                                start: {
                                    name: start,
                                    lat: start_lat,
                                    long: start_long
                                },
                                end: {
                                    name: end,
                                    lat: end_lat,
                                    long: end_long
                                }
                            };
                        // Send the users information to the cloud as a string
                        // Form the entity to be sent 
                        var updateUser = {
                            PartitionKey: entGen.String(phone),
                            RowKey: entGen.String(pin),
                            Visited_Locations: entGen.String(JSON.stringify(visitedLocations))
                        };
                        tableService.insertOrMergeEntity("User", updateUser, function (error, result, response) {
                            if (!error) {
                                console.log("User info updated on the table");
                            }
                            else {
                                console.log("There was an error adding the person: \n\n");
                                console.log(error);
                            }
                        });
                    }
                }
            });
        }
        // Build the message for the locations
        var message = new builder.Message(session)
            .attachments([{
                contentType: "image/png",
                contentUrl: map_builder.map_image_route_builder(start_lat, start_long, end_lat, end_long)
            }])
            .text("Here is a map of you locations!");
        // Send the message
        session.send(message);
        // Log step to console
        console.log("Getting Google Transit informaiton");
        // Flags for finished api pulls
        var transitFlag = false;
        var uberFlag = false;
        var lyftFlag = false;
        //=========================================================
        // Google Transit
        //=========================================================
        var transitUrl = 'https://maps.googleapis.com/maps/api/directions/json?';
        var transitOrigin = '&origin=' + start_lat + ',' + start_long;
        var transitDestination = '&destination=' + end_lat + ',' + end_long;
        var transitMode = '&mode=transit';
        var transitLanguage = "&language=en";
        var transitUnits = '&units=imperial';
        var transitKey = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";
        var transitQuery = transitUrl + transitOrigin + transitDestination + transitMode + transitLanguage + transitUnits +
            transitKey;
        var transitHeaders = {
            'Content-Type': 'application/json',
            'Accept-Language': 'en_EN'
        };
        var transitOptions = {
            url: transitQuery,
            headers: transitHeaders
        };
        // Send the request for transif information
        request(transitOptions, function (error, response, info) {
            // Check if Error
            if (error) {
                // Send a message to indicate error 
                console.log(error);
                console.log("There was an error in google transit information");
                session.send("There was an unknown error getting transit info");
                // create the error code
                var errorTransit = {
                    transitArrivalTime: "Error",
                    transitDepartureTime: "Error",
                    transitDistance: "Error",
                    transitDuration: "Error",
                    transitSteps: []
                };
                transitFlag = true;
                session.privateConversationData.Transit = errorTransit;
            }
            else {
                console.log("No error in transit");
                // Convert the string into json 
                var body = JSON.parse(info);
                if (body.status != "OK") {
                    console.log("No transit in area");
                    session.send("Transit is not available in this area.");
                    // create the error code
                    var errorTransit = {
                        transitArrivalTime: "Error",
                        transitDepartureTime: "Error",
                        transitDistance: "Error",
                        transitDuration: "Error",
                        transitSteps: []
                    };
                    session.privateConversationData.Transit = errorTransit;
                    transitFlag = true;
                }
                else {
                    console.log("Transit in area");
                    for (var route_step = 0; route_step < body.routes.length; route_step++) {
                        // Right now there is only 1 route
                        var legs = body.routes[route_step].legs;
                        // loop through each leg
                        // Right now there is only 1 leg because there are no waypoints
                        legs.forEach(function (leg) {
                            // Need to make sure that it is not only walking directions    
                            var transitLegInfo;
                            if (leg.steps.length == 1) {
                                var currentTime = Date.now();
                                var departureTime = currentTime;
                                // Google Transit give time value in seconds
                                // Muliply by 10 to get milliseconds to add to Date
                                var arrivalTime = currentTime + (leg.duration.value * 10);
                                // Convert the times into Date 
                                var departureDate = new Date(departureTime);
                                var arrivalDate = new Date(arrivalTime);
                                transitLegInfo =
                                    {
                                        transitArrivalTime: arrivalDate.getHours().toString() + (arrivalDate.getMinutes() < 10 ? ':0' : ':') + arrivalDate.getMinutes().toString(),
                                        transitDepartureTime: departureDate.getHours() + (departureDate.getMinutes() < 10 ? ":0" : ":") + departureDate.getMinutes(),
                                        transitDistance: leg.distance.text,
                                        transitDuration: leg.duration.text,
                                        transitSteps: [],
                                    };
                            }
                            else {
                                transitLegInfo =
                                    {
                                        transitArrivalTime: leg.arrival_time.text,
                                        transitDepartureTime: leg.departure_time.text,
                                        transitDistance: leg.distance.text,
                                        transitDuration: leg.duration.text,
                                        transitSteps: [],
                                    };
                            }
                            // There are many steps
                            var steps = leg.steps;
                            steps.forEach(function (step) {
                                if (step.travel_mode == "WALKING") {
                                    var walkingStepInfo_1 = {
                                        stepDistance: step.distance.text,
                                        stepDuration: step.duration.text,
                                        stepMainInstruction: step.html_instructions,
                                        stepTransitMode: step.travel_mode,
                                        stepDeatiledInstructions: []
                                    };
                                    step.steps.forEach(function (detailedStep) {
                                        var detailedStepInfo = {
                                            stepDistance: detailedStep.distance.text,
                                            stepDuration: detailedStep.duration.text,
                                            stepMainInstruction: HtmlParse(detailedStep.html_instructions),
                                            stepTransitMode: detailedStep.travel_mode
                                        };
                                        // Add to Main step deailted instruction array 
                                        walkingStepInfo_1.stepDeatiledInstructions.push(detailedStepInfo);
                                    });
                                    // Add the step and instruction to the main leg info
                                    transitLegInfo.transitSteps.push(walkingStepInfo_1);
                                }
                                else {
                                    var transitStepInfo = {
                                        stepDistance: step.distance.text,
                                        stepDuration: step.duration.text,
                                        stepMainInstruction: step.html_instructions,
                                        stepTransitMode: step.travel_mode,
                                        arrivalStopName: step.transit_details.arrival_stop.name,
                                        arrivalStopTime: step.transit_details.arrival_time.text,
                                        departureStopName: step.transit_details.departure_stop.name,
                                        departureStopTime: step.transit_details.departure_time.text,
                                        numberOfStop: step.transit_details.num_stops,
                                        vehicleName: step.transit_details.headsign,
                                        vehicleType: step.transit_details.line.vehicle.type
                                    };
                                    // Push to steps
                                    transitLegInfo.transitSteps.push(transitStepInfo);
                                }
                            });
                            // save the transit information
                            session.privateConversationData.Transit = transitLegInfo;
                            transitFlag = true;
                        });
                    }
                }
            }
        });
        //=========================================================
        // Uber information 
        //=========================================================
        console.log("In uber");
        // Set all of the constants
        var client_id = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP'; //process.env.UBER_APP_ID,
        var client_secret = 'vAy-juG54SV15yiv7hsDgVMegvMDPbjbtuayZ48a'; //process.env.UBER_APP_PASSWORD,
        var server_token = 'CSQlbbbn6k0gbYZULEqiLk0cwUy03ZIPkIYxPrOs'; //process.env.UBER_APP_TOKEN,
        var perference = session.privateConversationData.perference;
        var group = session.privateConversationData.group;
        var rides = [];
        // Send the request for products
        // This is where we will check for seat capcaity and or luxury options
        // This is mainly to exclude certain options, not to include
        var headers = {
            'Authorization': 'Token ' + server_token,
            'Content-Type': 'application/json',
            'Accept-Language': 'en_EN'
        };
        var options = {
            url: 'https://api.uber.com/v1.2/products?latitude=' + start_lat + '&longitude=' + start_long,
            headers: headers
        };
        request(options, function (error, response, info) {
            if (error || response.statusCode == 400) {
                // TODO: skip over uber
                console.log("Error when getting uber info");
                console.log(error);
                console.log(response.statusCode);
                var best_uber_option = {
                    uber_distance: Number.MAX_SAFE_INTEGER,
                    uber_driver_time: Number.MAX_SAFE_INTEGER,
                    uber_name: "Error",
                    uber_price: Number.MAX_SAFE_INTEGER,
                    uber_productId: "Error",
                    uber_travel_time: Number.MAX_SAFE_INTEGER
                };
                uberFlag = true;
                // Set the User data
                session.privateConversationData.Uber = best_uber_option;
            }
            else {
                var body = JSON.parse(info);
                console.log("Got Uber Product info");
                for (var index = 0; index < body.products.length; index++) {
                    var ride = body.products[index];
                    if (perference == 2) {
                        if (ride.display_name == "SELECT" || ride.display_name == "BLACK" || ride.display_name == "SUV") {
                            if (group == 0) {
                            }
                            else if (group == 1) {
                                if (ride.capacity > 4) {
                                    rides.push({ display_name: ride.display_name });
                                }
                            }
                            else if (group == 2) {
                                if (ride.capacity < 5) {
                                    rides.push({ display_name: ride.display_name });
                                }
                            }
                        }
                    }
                    else {
                        if (group == 0) {
                            rides.push({ display_name: ride.display_name });
                            continue;
                        }
                        else if (group == 1) {
                            if (ride.capacity > 2) {
                                rides.push({ display_name: ride.display_name });
                                continue;
                            }
                        }
                        else if (group == 2) {
                            if (ride.capacity > 4) {
                                rides.push({ display_name: ride.display_name });
                                continue;
                            }
                        }
                    }
                }
                // Send the request for Prices
                // Set the headers 
                headers = {
                    'Authorization': 'Token ' + server_token,
                    'Content-Type': 'application/json',
                    'Accept-Language': 'en_EN'
                };
                // Set the options 
                options = {
                    url: 'https://api.uber.com/v1.2/estimates/price?start_latitude=' + start_lat + '&start_longitude=' + start_long + '&end_latitude=' + end_lat + '&end_longitude=' + end_long,
                    method: 'GET',
                    headers: headers
                };
                // Make the request 
                request(options, function (error, response, info) {
                    // Send the uber information to the cloud as a string
                    // Form the entity to be sent 
                    var UberJson = {
                        PartitionKey: entGen.String('Uber'),
                        RowKey: entGen.String(session.message.user.id + ":" + now),
                        Rideshare: entGen.String(info),
                        Start_Lat: start_lat,
                        Start_Long: start_long,
                        End_Lat: end_lat,
                        End_Long: end_long
                    };
                    tableService.insertEntity("Rideshare", UberJson, function (error, result, response) {
                        if (!error) {
                            console.log("Uber Info added to Table");
                        }
                        else {
                            console.log("There was an error adding the person: \n\n");
                            console.log(error);
                        }
                    });
                    // Convert the string into JSON
                    var body = JSON.parse(info);
                    console.log(body);
                    var product = [];
                    // Set variables to hold the infomration
                    var uber_price = 99999;
                    var best_uber_option = {
                        uber_distance: 0,
                        uber_driver_time: 0,
                        uber_name: "",
                        uber_price: 0,
                        uber_productId: "",
                        uber_travel_time: 0
                    };
                    // Check to see if error 
                    if (error || response.statusCode == 400) {
                        // Log the error
                        console.log(error);
                        console.log(response.statusCode);
                        console.log("Not able to find pricing info");
                        var best_uber_option_1 = {
                            uber_distance: Number.MAX_SAFE_INTEGER,
                            uber_driver_time: Number.MAX_SAFE_INTEGER,
                            uber_name: "Error",
                            uber_price: Number.MAX_SAFE_INTEGER,
                            uber_productId: "Error",
                            uber_travel_time: Number.MAX_SAFE_INTEGER
                        };
                        uberFlag = true;
                        // Set the User data
                        session.privateConversationData.Uber = best_uber_option_1;
                    }
                    else {
                        console.log("Have Uber prices");
                        // Loop through each ride and match with product information 
                        for (var index = 0; index < body.prices.length; index++) {
                            var ride = body.prices[index];
                            // Check to see if the product matches the terms already
                            for (var e = 0; e < rides.length; e++) {
                                if (ride.display_name == rides[e].display_name) {
                                    // Add the price info to the product array
                                    product.push(ride);
                                }
                            }
                        }
                        // Now compare and find the cheapest price 
                        for (var index = 0; index < product.length; index++) {
                            // Create a holding variable
                            var ride = product[index];
                            // If index is 0 set the base price to that index
                            if (index == 0) {
                                // Change the pricing informaiton
                                uber_price = ride.high_estimate;
                                // Set the variable
                                best_uber_option = {
                                    uber_distance: ride.distance,
                                    uber_driver_time: 0,
                                    uber_name: ride.display_name,
                                    uber_price: (ride.high_estimate + ride.low_estimate) / 2,
                                    uber_productId: ride.product_id,
                                    uber_travel_time: ride.duration
                                };
                            }
                            if (uber_price > ride.high_estimate) {
                                uber_price = ride.high_estimate;
                                // Set the variable
                                best_uber_option = {
                                    uber_distance: parseFloat(ride.display_name),
                                    uber_driver_time: 0,
                                    uber_name: ride.display_name,
                                    uber_price: (ride.high_estimate + ride.low_estimate) / 2,
                                    uber_productId: ride.product_id,
                                    uber_travel_time: ride.duration
                                };
                            }
                        }
                        // Send the request for Times
                        // Set the headers 
                        headers = {
                            'Authorization': 'Token ' + server_token,
                            'Content-Type': 'application/json',
                            'Accept-Language': 'en_EN'
                        };
                        // Set the options 
                        options = {
                            url: 'https://api.uber.com/v1.2/estimates/time?start_latitude=' + start_lat + '&start_longitude=' + start_long + '&product_id=' + best_uber_option.uber_productId,
                            method: 'GET',
                            headers: headers
                        };
                        // Send the request for the time
                        request(options, function (error, response, info) {
                            // Parse the string into json
                            var body = JSON.parse(info);
                            if (error || response.statusCode != 200 || body.times.length == 0) {
                                console.log(error);
                                console.log(response.statusCode);
                                console.log(info);
                                console.log("Unable to find drivers");
                                var best_uber_option_2 = {
                                    uber_distance: Number.MAX_SAFE_INTEGER,
                                    uber_driver_time: Number.MAX_SAFE_INTEGER,
                                    uber_name: "Error",
                                    uber_price: Number.MAX_SAFE_INTEGER,
                                    uber_productId: "Error",
                                    uber_travel_time: Number.MAX_SAFE_INTEGER
                                };
                                uberFlag = true;
                                // Set the User data
                                session.privateConversationData.Uber = best_uber_option_2;
                            }
                            else {
                                console.log("Have driver times");
                                best_uber_option.uber_driver_time = body.times[0].estimate;
                                // Set the User data
                                session.privateConversationData.Uber = best_uber_option;
                            }
                            uberFlag = true;
                            console.log("Finished Uber Driver Time");
                        });
                        console.log("Finished Uber Price");
                    }
                });
                console.log("Finished Uber Products");
            }
        });
        //=========================================================
        // Lyft information 
        //=========================================================
        console.log("In Lyft");
        // Declare the constants
        var lyftClientId = 'gAAAAABZIPjkPxmPgs83bWslOmxyt26-4AFcNDYZOwXWj4gyu7NEjddtxNK0DeNOqRrIsOCjKF-16_NiqApbMT-5vtGXJaulRmRk6b6QqDpYyU0MGYojno-FKnn58KzWRPwfoqFF8MUA5LTP0FpoNScafNXOeSgdic1eWsoGQm6Kg5c7TyQviRQ=';
        var lyftHeaders = {
            'Authorization': 'bearer ' + lyftClientId
        };
        var lyftOptions = {
            url: 'https://api.lyft.com/v1/ridetypes?lat=' + start_lat + '&lng=' + start_long,
            headers: lyftHeaders
        };
        // Holds the type of rides that fits the user profile
        // Luxury and Group
        var lyftRideTypes = [];
        // Hold the Rides that fit the time 
        var lyftRides = [];
        // Send the request to lyft for products
        // Find the best value
        request(lyftOptions, function (error, response, info) {
            if (error || response.statusCode != 200) {
                console.log(error);
                console.log(response.statusCode);
                console.log("Cannot find products");
                var best_lyft_option = {
                    display_name: "Error",
                    driver_time: Number.MAX_SAFE_INTEGER,
                    estimated_distance_miles: Number.MAX_SAFE_INTEGER,
                    estimated_duration_seconds: Number.MAX_SAFE_INTEGER,
                    price: Number.MAX_SAFE_INTEGER,
                    primetime_percentage: "Error",
                    ride_type: "Error"
                };
                lyftFlag = true;
                // Save the info to user data
                session.privateConversationData.Lyft = best_lyft_option;
            }
            else {
                console.log("In lyft Ride Types");
                var body = JSON.parse(info);
                for (var index = 0; index < body.ride_types.length; index++) {
                    var ride = body.ride_types[index];
                    if (perference == 2) {
                        if (ride.display_name == "Lyft Premier" || ride.display_name == "Lyft Lux" || ride.display_name == "Lyft Lux SUV") {
                            if (group == 0) {
                                lyftRideTypes.push({
                                    ride_type: ride.ride_type,
                                    display_name: ride.display_name
                                });
                                continue;
                            }
                            else if (group == 1) {
                                if (ride.seats > 2) {
                                    lyftRideTypes.push({
                                        ride_type: ride.ride_type,
                                        display_name: ride.display_name
                                    });
                                    continue;
                                }
                            }
                            else if (group == 2) {
                                if (ride.seats > 4) {
                                    lyftRideTypes.push({
                                        ride_type: ride.ride_type,
                                        display_name: ride.display_name
                                    });
                                    continue;
                                }
                            }
                        }
                    }
                    else {
                        if (group == 0) {
                            lyftRideTypes.push({
                                ride_type: ride.ride_type,
                                display_name: ride.display_name
                            });
                            continue;
                        }
                        else if (group == 1) {
                            if (ride.seats > 2) {
                                lyftRideTypes.push({
                                    ride_type: ride.ride_type,
                                    display_name: ride.display_name
                                });
                                continue;
                            }
                        }
                        else if (group == 2) {
                            if (ride.seats > 4) {
                                lyftRideTypes.push({
                                    ride_type: ride.ride_type,
                                    display_name: ride.display_name
                                });
                                continue;
                            }
                        }
                    }
                }
                // Send the new request for Ride Pricing
                var lyftHeaders_1 = {
                    'Authorization': 'bearer ' + lyftClientId
                };
                var lyftOptions_1 = {
                    url: 'https://api.lyft.com/v1/cost?start_lat=' + start_lat + '&start_lng=' + start_long + '&end_lat=' + end_lat + '&end_lng=' + end_long,
                    headers: lyftHeaders_1
                };
                // Send the request
                request(lyftOptions_1, function (error, response, info) {
                    if (error || response.statusCode == 400) {
                        console.log(error);
                        console.log(response.statusCode);
                        var best_lyft_option = {
                            display_name: "Error",
                            driver_time: Number.MAX_SAFE_INTEGER,
                            estimated_distance_miles: Number.MAX_SAFE_INTEGER,
                            estimated_duration_seconds: Number.MAX_SAFE_INTEGER,
                            price: Number.MAX_SAFE_INTEGER,
                            primetime_percentage: "Error",
                            ride_type: "Error"
                        };
                        lyftFlag = true;
                        // Save the info to user data
                        session.privateConversationData.Lyft = best_lyft_option;
                    }
                    else {
                        console.log("Have lyft prices");
                        // Send the uber information to the cloud as a string
                        // Form the entity to be sent 
                        var LyftJson = {
                            PartitionKey: entGen.String('Lyft'),
                            RowKey: entGen.String(session.message.user.id + ":" + now),
                            Rideshare: entGen.String(info),
                            Start_Lat: start_lat,
                            Start_Long: start_long,
                            End_Lat: end_lat,
                            End_Long: end_long
                        };
                        tableService.insertEntity("Rideshare", LyftJson, function (error, result, response) {
                            if (!error) {
                                console.log("Uber Info added to Table");
                            }
                            else {
                                console.log("There was an error adding the person: \n\n");
                                console.log(error);
                            }
                        });
                        var body_1 = JSON.parse(info);
                        console.log(body_1);
                        // Lyft prices
                        var lyft_price = 99999;
                        var best_lyft_option_1 = {
                            ride_type: "",
                            estimated_duration_seconds: 0,
                            estimated_distance_miles: 0,
                            price: 0,
                            primetime_percentage: "",
                            driver_time: 0,
                            display_name: ""
                        };
                        // Loop through each ride and match with previous information
                        for (var index = 0; index < body_1.cost_estimates.length; index++) {
                            var ride = body_1.cost_estimates[index];
                            // Check to see if it matches the one based on group and luxury
                            for (var e = 0; e < lyftRideTypes.length; e++) {
                                if (ride.display_name == lyftRideTypes[e].display_name) {
                                    // add the price infor to the product array 
                                    lyftRides.push(ride);
                                }
                            }
                        }
                        // Compares and find the cheapest price 
                        for (var index = 0; index < lyftRides.length; index++) {
                            // Holding variable to reference the ride
                            var ride = lyftRides[index];
                            // If index = 0 set the initial info to that
                            if (index == 0) {
                                lyft_price = ride.estimated_cost_cents_max;
                                best_lyft_option_1 = {
                                    display_name: ride.display_name,
                                    price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 200),
                                    estimated_distance_miles: ride.estimated_distance_miles,
                                    estimated_duration_seconds: ride.estimated_duration_seconds,
                                    primetime_percentage: ride.primetime_percentage,
                                    ride_type: ride.ride_type,
                                    driver_time: 0
                                };
                            }
                            // If the ride is cheaper than the previous
                            if (ride.estimated_cost_cents_max < lyft_price) {
                                lyft_price = ride.estimated_cost_cents_max;
                                best_lyft_option_1 = {
                                    display_name: ride.display_name,
                                    price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 200),
                                    estimated_distance_miles: ride.estimated_distance_miles,
                                    estimated_duration_seconds: ride.estimated_duration_seconds,
                                    primetime_percentage: ride.primetime_percentage,
                                    ride_type: ride.ride_type,
                                    driver_time: 0
                                };
                            }
                        }
                        // Send the new request for Driver Times
                        var lyftHeaders_2 = {
                            'Authorization': 'bearer ' + lyftClientId
                        };
                        var lyftOptions_2 = {
                            url: 'https://api.lyft.com/v1/eta?lat=' + start_lat + '&lng=' + start_long + '&ride_type=' + best_lyft_option_1.ride_type,
                            headers: lyftHeaders_2
                        };
                        // Send the request for Driver times
                        request(lyftOptions_2, function (error, response, info) {
                            if (error || response.statusCode == 400) {
                                console.log(error);
                                console.log(response.statusCode);
                                var best_lyft_option_2 = {
                                    display_name: "Error",
                                    driver_time: Number.MAX_SAFE_INTEGER,
                                    estimated_distance_miles: Number.MAX_SAFE_INTEGER,
                                    estimated_duration_seconds: Number.MAX_SAFE_INTEGER,
                                    price: Number.MAX_SAFE_INTEGER,
                                    primetime_percentage: "Error",
                                    ride_type: "Error"
                                };
                                lyftFlag = true;
                                // Save the info to user data
                                session.privateConversationData.Lyft = best_lyft_option_2;
                            }
                            else {
                                // Parse the JSON
                                var body_2 = JSON.parse(info);
                                // Set the Driver time
                                best_lyft_option_1.driver_time = body_2.eta_estimates[0].eta_seconds;
                                // Save the info to user data
                                session.privateConversationData.Lyft = best_lyft_option_1;
                            }
                            lyftFlag = true;
                            console.log("Finished Lyft Time");
                        });
                    }
                    console.log("Finished Lyft Price");
                });
                console.log("Finished All of Lyft");
            }
        });
        //=========================================================
        // Car2Go information 
        //=========================================================
        //=========================================================
        // End of Calculations
        //=========================================================
        console.log("Finished");
        function Timeout(transit, uber, lyft, next) {
            if (transit && uber && lyft) {
                // Go to the aggregations
                return next();
            }
            else {
                setTimeout(function () {
                    console.log("Waiting for information");
                    return Timeout(transitFlag, uberFlag, lyftFlag, next);
                }, 150);
            }
        }
        ;
        Timeout(transitFlag, uberFlag, lyftFlag, next);
    },
    //=========================================================
    // Match with user perferences 
    //=========================================================
    function (session, response, next) {
        console.log("Matching with user preference");
        // Grab the user preference
        var preference = session.privateConversationData.perference;
        // Grab the infomation
        var uber = session.privateConversationData.Uber;
        var lyft = session.privateConversationData.Lyft;
        var transitInfo = session.privateConversationData.Transit;
        var rideshare = {
            driverTime: "Error",
            price: 'Error',
            serviceProvider: "Error",
            serviceType: "Error",
            totalDistance: "Error",
            totalTime: "Error",
            proudctId: "Error"
        };
        console.log(uber);
        console.log(lyft);
        // If there is an error at all
        if (uber.uber_name == "Error" || lyft.display_name == "Error") {
            // If uber and not lyft
            if (uber.uber_name == "Error" && lyft.display_name != "Error") {
                rideshare =
                    {
                        driverTime: (lyft.driver_time / 60).toFixed(2),
                        price: lyft.price.toFixed(2),
                        serviceProvider: "Lyft",
                        serviceType: lyft.display_name,
                        totalDistance: lyft.estimated_distance_miles.toFixed(2),
                        totalTime: (lyft.estimated_duration_seconds / 60).toFixed(2),
                        proudctId: lyft.ride_type
                    };
            }
            else if (uber.uber_name != "Error" && lyft.display_name == "Error") {
                rideshare =
                    {
                        driverTime: (uber.uber_driver_time / 60).toFixed(2),
                        price: uber.uber_price.toFixed(2),
                        serviceProvider: "Uber",
                        serviceType: uber.uber_name,
                        totalDistance: uber.uber_distance.toFixed(2),
                        totalTime: (uber.uber_travel_time / 60).toFixed(2),
                        proudctId: uber.uber_productId
                    };
            }
            else {
                // Rideshare remains the same
            }
        }
        else if (preference == 0) {
            var uberPrice = uber.uber_price;
            var lyftPrice = lyft.price;
            // Find the lower price
            if (uberPrice < lyftPrice) {
                rideshare =
                    {
                        driverTime: (uber.uber_driver_time / 60).toFixed(2),
                        price: uberPrice.toFixed(2),
                        serviceProvider: "Uber",
                        serviceType: uber.uber_name,
                        totalDistance: uber.uber_distance.toFixed(2),
                        totalTime: (uber.uber_travel_time / 60).toFixed(2),
                        proudctId: uber.uber_productId
                    };
            }
            else {
                rideshare =
                    {
                        driverTime: (lyft.driver_time / 60).toFixed(2),
                        price: lyft.price.toFixed(2),
                        serviceProvider: "Lyft",
                        serviceType: lyft.display_name,
                        totalDistance: lyft.estimated_distance_miles.toFixed(2),
                        totalTime: (lyft.estimated_duration_seconds / 60).toFixed(2),
                        proudctId: lyft.ride_type
                    };
            }
        }
        else if (preference == 1) {
            var uberDriverTime = uber.uber_driver_time;
            var lyftDriverTime = lyft.driver_time;
            if (uberDriverTime < lyftDriverTime) {
                rideshare =
                    {
                        driverTime: (uber.uber_driver_time / 60).toFixed(2),
                        price: uber.uber_price.toFixed(2),
                        serviceProvider: "Uber",
                        serviceType: uber.uber_name,
                        totalDistance: uber.uber_distance.toFixed(2),
                        totalTime: (uber.uber_travel_time / 60).toFixed(2),
                        proudctId: uber.uber_productId
                    };
            }
            else {
                rideshare =
                    {
                        driverTime: (lyft.driver_time / 60).toFixed(2),
                        price: lyft.price.toFixed(2),
                        serviceProvider: "Lyft",
                        serviceType: lyft.display_name,
                        totalDistance: lyft.estimated_distance_miles.toFixed(2),
                        totalTime: (lyft.estimated_duration_seconds / 60).toFixed(2),
                        proudctId: lyft.ride_type
                    };
            }
        }
        else if (preference == 2) {
            var uberPrice = uber.uber_price;
            var lyftPrice = lyft.price;
            // Find the lower price
            if (uberPrice < lyftPrice) {
                rideshare =
                    {
                        driverTime: (uber.uber_driver_time / 60).toFixed(2),
                        price: uberPrice.toFixed(2),
                        serviceProvider: "Uber",
                        serviceType: uber.uber_name,
                        totalDistance: uber.uber_distance.toFixed(2),
                        totalTime: (uber.uber_travel_time / 60).toFixed(2),
                        proudctId: uber.uber_productId
                    };
            }
            else {
                rideshare =
                    {
                        driverTime: (lyft.driver_time / 60).toFixed(2),
                        price: lyft.price.toFixed(2),
                        serviceProvider: "Lyft",
                        serviceType: lyft.display_name,
                        totalDistance: lyft.estimated_distance_miles.toFixed(2),
                        totalTime: (lyft.estimated_duration_seconds / 60).toFixed(2),
                        proudctId: lyft.ride_type
                    };
            }
        }
        ////////////////////////////////////////////
        //                                       //
        //          BUILD THE MESSAGES           //   
        //                                       //
        ///////////////////////////////////////////
        if (session.message.source != 'skype') {
            // Build the transit string 
            var transitMessage = [];
            // Check to see if there is an error with the ridesharing 
            var rideshareMessage = [];
            if (transitInfo.transitDistance == "Error") {
                console.log("Building the transit error message");
                transitMessage =
                    [
                        { "type": "TextBlock",
                            "text": "Transit Not Found",
                            "size": "medium",
                            "weight": "bolder"
                        }
                    ];
            }
            else {
                console.log("Building the transit message");
                transitMessage =
                    [
                        { "type": "TextBlock",
                            "text": "Transit",
                            "size": "medium",
                            "weight": "bolder"
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Departure Time: " + transitInfo.transitDepartureTime
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Arrival Time: " + transitInfo.transitArrivalTime
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Distance: " + transitInfo.transitDistance + " miles"
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Duration: " + transitInfo.transitDuration
                        }
                    ];
            }
            if (rideshare.serviceType == "Error") {
                console.log("Building the rideshare error message");
                rideshareMessage =
                    [
                        {
                            "type": "TextBlock",
                            "text": "Rideshare Not Found",
                            "size": "medium",
                            "weight": "bolder"
                        }
                    ];
            }
            else {
                console.log("Building the rideshare message");
                rideshareMessage =
                    [
                        { "type": "TextBlock",
                            "text": "Rideshare",
                            "size": "medium",
                            "weight": "bolder"
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Service: " + rideshare.serviceProvider
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Ride Type: " + rideshare.serviceType
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Price: $" + rideshare.price
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Driver Distance: " + rideshare.driverTime + " minutes away"
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Total Distance: " + rideshare.totalDistance + " miles"
                        },
                        {
                            "type": "TextBlock",
                            "text": "- Total Duration: " + rideshare.totalTime + " minutes"
                        }
                    ];
            }
            // Send the master message
            console.log("Building the master message");
            var masterMessage = new builder.Message(session)
                .addAttachment({
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    type: 'AdaptiveCard',
                    body: [
                        {
                            "type": "Container",
                            "separation": "default",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": "Transportation Options",
                                    "size": "large",
                                    "weight": "bolder"
                                }
                            ]
                        },
                        {
                            "type": "Container",
                            "separation": "default",
                            "style": "normal",
                            "items": transitMessage
                        },
                        {
                            "type": "Container",
                            "separation": "default",
                            "items": rideshareMessage
                        }
                    ]
                }
            });
            session.send(masterMessage);
        }
        else {
            // Build the transit string 
            var transitString = void 0;
            if (transitInfo.transitDistance == "Error") {
                console.log("Building skype error string");
                transitString = 'We could not find transit in this area <br/> <br/>';
            }
            else {
                // Build out the strings
                console.log("Building transit string");
                transitString = "Transit <br/>\n                - Departure Time: " + transitInfo.transitDepartureTime + " <br/>\n                - Arrival Time: " + transitInfo.transitArrivalTime + " <br/>\n                - Distance: " + transitInfo.transitDistance + " miles <br/>\n                - Duration " + transitInfo.transitDuration + " minutes <br/>";
            }
            // Check to see if there is an error with the ridesharing 
            var rideshareString = void 0;
            if (rideshare.serviceType == "Error") {
                console.log("Building rideshare error string");
                rideshareString = "We could not find any rideharing options";
            }
            else {
                console.log("Building rideshare string");
                rideshareString = "Rideshare <br/>\n                - Service: " + rideshare.serviceProvider + " <br/>\n                - Ride Type: " + rideshare.serviceType + " <br/>\n                - Price: " + rideshare.price + " <br/>\n                - Driver Distance: " + rideshare.driverTime + " minutes away <br/>\n                - Total Distance: " + rideshare.totalDistance + " miles <br/>\n                - Total Duration: " + rideshare.totalTime + " minutes <br/>";
            }
            session.send(transitString + rideshareString);
        }
        // Add the options to the privateConversationData
        session.privateConversationData.Rideshare = rideshare;
        session.replaceDialog("/options");
    }
]);
// Dialogue for infomation 
bot.dialog("/options", [
    function (session) {
        builder.Prompts.choice(session, "Type the number or name to order or get more info or hit finished", ["Transit", 'Rideshare', "Finished"]);
    },
    function (session, response, next) {
        // Get the transit and rideshare options 
        var transit = session.privateConversationData.Transit;
        var rideshare = session.privateConversationData.Rideshare;
        var startLat = session.privateConversationData.start_lat;
        var startLong = session.privateConversationData.start_long;
        var endLat = session.privateConversationData.end_lat;
        var endLong = session.privateConversationData.end_long;
        if (response.response) {
            // User wants to see transit information
            if (response.response.index == 0) {
                if (transit.transitArrivalTime == "Error") {
                    session.send("There was an error when looking for transit in your locations.");
                }
                else {
                    if (session.message.source != 'skype') {
                        // Array to Hold all direction string 
                        var stepMessage_1 = [];
                        for (var step = 0; step < transit.transitSteps.length; step++) {
                            // Check to see if walking or transit step
                            if (transit.transitSteps[step].stepTransitMode == "WALKING") {
                                var walkingStep = transit.transitSteps[step];
                                var instructions = [
                                    {
                                        "type": "TextBlock",
                                        "text": "" + walkingStep.stepMainInstruction,
                                        "size": "medium",
                                        "weight": "bolder",
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Distance: " + walkingStep.stepDistance,
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Duration: " + walkingStep.stepDuration,
                                        "wrap": true
                                    }
                                ];
                                for (var step_1 = 0; step_1 < walkingStep.stepDeatiledInstructions.length; step_1++) {
                                    if (step_1 == walkingStep.stepDeatiledInstructions.length - 1) {
                                        instructions.push({
                                            "type": "TextBlock",
                                            "text": "- Step " + (step_1 + 1) + ": " + walkingStep.stepDeatiledInstructions[step_1].stepMainInstruction,
                                            "wrap": true
                                        });
                                    }
                                    else {
                                        instructions.push({
                                            "type": "TextBlock",
                                            "text": "- Step " + (step_1 + 1) + ": " + walkingStep.stepDeatiledInstructions[step_1].stepMainInstruction,
                                            "wrap": true
                                        });
                                    }
                                }
                                instructions.forEach(function (step) {
                                    stepMessage_1.push(step);
                                });
                            }
                            else {
                                var transitStep = transit.transitSteps[step];
                                var transitMessage = [
                                    {
                                        "type": "TextBlock",
                                        "text": "" + transitStep.stepMainInstruction,
                                        "size": "medium",
                                        "weight": "bolder",
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Depature Name: " + transitStep.departureStopName,
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Deapture Time: " + transitStep.departureStopTime,
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Arrival Name: " + transitStep.arrivalStopName,
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Arrival Time: " + transitStep.arrivalStopTime,
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Distance: " + transitStep.stepDistance + " miles",
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Duration: " + transitStep.stepDuration + " minutes",
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Number of Stops: " + transitStep.numberOfStop,
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Vehicle Name: " + transitStep.vehicleName + " ",
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "- Vehicle Type: " + transitStep.vehicleType,
                                        "wrap": true
                                    }
                                ];
                                transitMessage.forEach(function (step) {
                                    stepMessage_1.push(step);
                                });
                            }
                        }
                        // Build the step by step directions
                        var directionMessage = new builder.Message(session)
                            .addAttachment({
                            contentType: "application/vnd.microsoft.card.adaptive",
                            content: {
                                type: 'AdaptiveCard',
                                body: [
                                    {
                                        "type": "Container",
                                        "separation": "default",
                                        "items": [
                                            {
                                                "type": "TextBlock",
                                                "text": "Transit Steps",
                                                "size": "large",
                                                "weight": "bolder"
                                            }
                                        ]
                                    },
                                    {
                                        "type": "Container",
                                        "items": stepMessage_1
                                    }
                                ]
                            }
                        });
                        session.send(directionMessage);
                        // repeat the dialog
                        session.replaceDialog('/options');
                    }
                    else {
                        // Array to Hold all direction string 
                        var directions = "";
                        for (var step = 0; step < transit.transitSteps.length; step++) {
                            // Check to see if walking or transit step
                            if (transit.transitSteps[step].stepTransitMode == "WALKING") {
                                var walkingStep = transit.transitSteps[step];
                                directions += walkingStep.stepMainInstruction + " <br/> \n                                - Distance: " + walkingStep.stepDistance + " <br/>\n                                - Duration: " + walkingStep.stepDuration + " <br/>\n                                ";
                                for (var step_2 = 0; step_2 < walkingStep.stepDeatiledInstructions.length; step_2++) {
                                    if (step_2 == walkingStep.stepDeatiledInstructions.length - 1) {
                                        directions += "- Step " + (step_2 + 1) + ": " + walkingStep.stepDeatiledInstructions[step_2].stepMainInstruction + " <br/>";
                                    }
                                    else {
                                        directions += "- Step " + (step_2 + 1) + ": " + walkingStep.stepDeatiledInstructions[step_2].stepMainInstruction + " <br/> \n                                        ";
                                    }
                                }
                            }
                            else {
                                var transitStep = transit.transitSteps[step];
                                directions += transitStep.stepMainInstruction + " <br/>\n                                - Depature Name: " + transitStep.departureStopName + " <br/>\n                                - Deapture Time: " + transitStep.departureStopTime + " <br/>\n                                - Arrival Name: " + transitStep.arrivalStopName + " <br/>\n                                - Arrival Time: " + transitStep.arrivalStopTime + " <br/>\n                                - Distance: " + transitStep.stepDistance + " miles <br/>\n                                - Duration: " + transitStep.stepDuration + " minutes <br/>\n                                - Number of Stops: " + transitStep.numberOfStop + " <br/>\n                                - Vehicle Name: " + transitStep.vehicleName + " <br/>\n                                - Vehicle Type: " + transitStep.vehicleType + " <br/>";
                            }
                        }
                        session.send(directions);
                        // repeat the dialog
                        session.replaceDialog('/options');
                    }
                }
            }
            else if (response.response.index == 1) {
                // Check the rideshare service provider
                if (rideshare.serviceProvider == "Uber") {
                    if (session.message.source != 'skype') {
                        var uberClientId = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP'; //process.env.UBER_APP_ID
                        // Format the addresses
                        var pickup = LocationAddressFomater(session.privateConversationData.start);
                        var dropoff = LocationAddressFomater(session.privateConversationData.end);
                        var uberString = "https://m.uber.com/ul/?action=setPickup&client_id=" + uberClientId + "&product_id=" + rideshare.proudctId + "&pickup[formatted_address]=" + pickup + "&pickup[latitude]=" + startLat + "&pickup[longitude]=" + startLong + "&dropoff[formatted_address]=" + dropoff + "&dropoff[latitude]=" + endLat + "&dropoff[longitude]=" + endLong;
                        var uberCard = new builder.Message(session)
                            .addAttachment(new builder.ThumbnailCard(session)
                            .title("Order an Uber")
                            .text("Click to order your Uber in the Uber App!")
                            .images([builder.CardImage.create(session, 'https://d1a3f4spazzrp4.cloudfront.net/uber-com/1.2.29/d1a3f4spazzrp4.cloudfront.net/images/apple-touch-icon-144x144-279d763222.png')])
                            .buttons([builder.CardAction.openUrl(session, uberString, "Order an Uber"),
                            builder.CardAction.dialogAction(session, "repeatOptions", undefined, "Back to options"),
                            builder.CardAction.dialogAction(session, "endConversation", undefined, "Finish")])
                            .tap(builder.CardAction.openUrl(session, uberString, "Order Uber")));
                        session.send(uberCard);
                    }
                    else {
                        var uberClientId = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP'; //process.env.UBER_APP_ID
                        // Format the addresses
                        var pickup = LocationAddressFomater(session.privateConversationData.start);
                        var dropoff = LocationAddressFomater(session.privateConversationData.end);
                        // Order the Uber
                        session.send("Click the link to open the app and order your ride!");
                        var uberString = "'https://m.uber.com/ul/?action=setPickup&client_id=" + uberClientId + "&product_id=" + rideshare.proudctId + "&pickup[formatted_address]=" + pickup + "&pickup[latitude]=" + startLat + "&pickup[longitude]=" + startLong + "&dropoff[formatted_address]=" + dropoff + "&dropoff[latitude]=" + endLat + "&dropoff[longitude]=" + endLong;
                        session.send(uberString);
                    }
                }
                else if (rideshare.serviceProvider == 'Lyft') {
                    if (session.message.source != 'skype') {
                        var clientId = '9LHHn1wknlgs';
                        // Order the Lyft
                        var lyftString = "https://lyft.com/ride?id=" + rideshare.proudctId + "&pickup[latitude]=" + startLat + "&pickup[longitude]=" + startLong + "&partner=" + clientId + "&destination[latitude]=" + endLat + "&destination[longitude]=" + endLong;
                        var lyftCard = new builder.Message(session)
                            .addAttachment(new builder.ThumbnailCard(session)
                            .title("Order your Lyft!")
                            .text("Click the button to order your Lyft in the Lyft App!")
                            .subtitle("If on SMS say 'Order Lyft' to order the ride")
                            .images([builder.CardImage.create(session, "https://www.lyft.com/apple-touch-icon-precomposed-152x152.png")])
                            .tap(builder.CardAction.openUrl(session, lyftString, "Order Lyft"))
                            .buttons([builder.CardAction.openUrl(session, lyftString, "Order Lyft"),
                            builder.CardAction.dialogAction(session, "repeatOptions", undefined, "Back to options"),
                            builder.CardAction.dialogAction(session, "endConversation", undefined, "Finish")]));
                        session.send(lyftCard);
                    }
                    else {
                        var clientId = '9LHHn1wknlgs';
                        // Order the Lyft
                        session.send("Or click the link to open the app and order your ride!");
                        var lyftString = "https://lyft.com/ride?id=" + rideshare.proudctId + "&pickup[latitude]=" + startLat + "&pickup[longitude]=" + startLong + "&partner=" + clientId + "&destination[latitude]=" + endLat + "&destination[longitude]=" + endLong;
                        session.send(lyftString);
                    }
                }
                else {
                    session.send("We could not find any ridesharing options here");
                }
            }
            else {
                session.endConversation("Thank you for using Travelr! Have a great day!");
            }
        }
    }
]);
bot.dialog("/info", [
    function (session) {
        builder.Prompts.choice(session, "What information would you like to see", "Company Info|Privacy|How It Works|Finished");
    },
    function (session, response, next) {
        if (response.response) {
            if (response.response.index == 0) {
                session.send("Company Info\n                \n                Travelr is all about creating a more enjoyable commuting experience.\n                \n                We are your urban travel guide to make your daily commute better we match your preferences and find the best options \n                avialable for you including price, time, group size, and a luxurious option.\n\n                By connecting users to one another we enhance the quality of everyone's dialy commute. This means that every user\n                depending on their choice will be able to find the quickest route, the cheapest ride, or the best luxury deal available.");
            }
            else if (response.response.index == 1) {
                session.send("Privacy\n                \n                Retainment of information\n\n                This bot is currently in beta. We do not ask for nor retain personal information including but not limited to: Name, DOB, Mailing or Biling Address, etc...\n                Although, not yet implemented, Travelr does intend to eventually retain your starting location, destiantion, and the best services our system produces. \n                This information will eventually help us with creating a better and faster bot by allowing us to run analysis on the transportation systems in your geographic area.\n\n                Sale of information\n\n                We will not sell the retained informaiton. The informaiton will be used for our own purposes as stated above. We will update our privacy statements accordingly.");
            }
            else if (response.response.index == 2) {
                session.send("How It Works\n\n                Travelr asks the user for their commuting preferences and then it asks the user for their starting and ending locations. After\n                typing in their preferences and destination our algorithim internally finds the best choice for the user.");
            }
            else {
                session.send("Returning you back to the help dialog!");
                session.endDialog();
            }
        }
        console.log("Going to the next step");
        next();
    },
    function (session) {
        session.replaceDialog("/info");
    }
]);
bot.dialog("/account", [
    function (session, args, next) {
        console.log("Getting choice");
        builder.Prompts.choice(session, "Welcome to the account settings! Would you like to 'Sign Up', 'Login', 'Edit', or 'Cancel'?", ['Sign Up', 'Login', 'Edit', 'Cancel']);
    },
    function (session, results, next) {
        console.log("Directing the choice");
        if (results.response) {
            if (results.response.index == 0) {
                session.beginDialog('/signUp');
            }
            else if (results.response.index == 1) {
                session.beginDialog('/login');
            }
            else if (results.response.index == 2) {
                session.beginDialog('/edit');
            }
            else if (results.response.index == 3) {
                session.endDialog("Okay returning you to the main menu!");
            }
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
        if (results.response && results.response.index == 0) {
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
        var FavoriteLocations = session.userData.favoriteLocations;
        // Determine if undefined
        if (!FavoriteLocations) {
            FavoriteLocations = {};
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
        // save the data
        session.dialogData.tempFavoriteLocationAddress = results.response;
        // send an image of the correct location and verify
        // get the geocode
        googleMapsClient.geocode({ address: results.response }, function (err, response) {
            // get the latitutde
            var lat = response.json.results[0].geometry.location.lat;
            session.dialogData.lat = response.json.results[0].geometry.location.lat;
            // get the longitude
            var long = response.json.results[0].geometry.location.lng;
            session.dialogData.long = response.json.results[0].geometry.location.lng;
            var mapMessage = map_builder.map_card_builder(session, lat, long);
            mapMessage.text("Is this the correct information?");
            session.send(mapMessage);
            builder.Prompts.choice(session, "You said your location name was '" + session.dialogData.tempFavoriteLocationName + "' and the address was '" + results.response + ".' Is that correct?", ["Yes", "No"]);
        });
    },
    function (session, results, next) {
        if (results.response && results.response.index == 0) {
            // add the information to the array of favorite locations
            var tempFavoriteLocationName = session.dialogData.tempFavoriteLocationName;
            var tempFavoriteLocationAddress = session.dialogData.tempFavoriteLocationAddress;
            // Check to see if the user already has favorites
            var FavoriteLocation = session.userData.favoriteLocations;
            if (!FavoriteLocation) {
                console.log("There are no favorite locations");
                var FavoriteLocation_1 = {};
                FavoriteLocation_1[tempFavoriteLocationName] =
                    {
                        "address": tempFavoriteLocationAddress,
                        "lat": session.dialogData.lat,
                        "long": session.dialogData.long
                    };
                // Add the location to the favorite
                session.userData.favoriteLocations = FavoriteLocation_1;
            }
            else {
                console.log("Add a new favorite location");
                // Add the information about the location
                FavoriteLocation[tempFavoriteLocationName] =
                    {
                        "address": tempFavoriteLocationAddress,
                        "lat": session.dialogData.lat,
                        "long": session.dialogData.long
                    };
                session.userData.favoriteLocations = FavoriteLocation;
            }
            builder.Prompts.choice(session, "Would you like to add another favorite?", ["Yes", "No"]);
        }
        else if (results.response && results.response.index == 1) {
            session.send("Okay we will start over");
            session.replaceDialog("/addFavorites");
        }
    },
    function (session, results, next) {
        if (results.response && results.response.index == 0) {
            session.replaceDialog('/addFavorites');
        }
        else if (results.response && results.response.index == 1) {
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
            if (results.response && key == results.response.entity) {
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
        var query = new azureStorage.TableQuery()
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
                else {
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
        if (results.response && results.response.index == 0) {
            session.replaceDialog('/login');
        }
        else {
            session.endDialog("Okay I am returning you to the previous dialog.");
        }
    }
]);
bot.dialog('/edit', [
    function (session, args, next) {
        session.send("Welcome to the 'Account Edit Dialog!' We need to make sure you are logged in in first!");
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
        if (results.response && results.response.index == 0) {
            session.beginDialog('/removeFavorites');
        }
        else if (results.response && results.response.index == 1) {
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
bot.dialog('/commands', [
    function (session) {
        session.send("At anytime you can say the following commands: 'cancel', 'restart', 'help'. 'Cancel' stops bot," +
            "'Restart' restarts the current step, and 'Help' launches the help guide");
        session.endDialog("Returning you to the main help dialog!");
    }
]);
bot.dialog("/end", [
    function (session) {
        session.endConversation("Thank you for using Travelr! Have a great day!");
    }
]);
if (useEmulator) {
    var server_1 = restify.createServer();
    server_1.listen(process.env.port || process.env.PORT || 3978, function () {
        console.log('%s listening to %s', server_1.name, server_1.url);
    });
    server_1.post('/api/messages', connector.listen());
}
else {
    module.exports = { default: connector.listen() };
}
