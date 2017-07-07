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
import * as botbuilder_azure from "botbuilder-azure";
import * as azureStorage from 'azure-storage';
import * as map_builder from "./map_builder";

//=========================================================
// Google Maps Configure
//=========================================================

let googleMapsClient: any = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4' //process.env.GOOGLE_MAPS_KEY
});

//=========================================================
// Connector Configuration
//=========================================================
let useEmulator: boolean = (process.env.NODE_ENV == 'development');

//useEmulator = true;

let connector: any = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});


//=========================================================
// Storage Config
//=========================================================
let AzureTableClient = new botbuilder_azure.AzureTableClient("BotStorage", "travelrbotc4g2ai", 
    'cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==')

let UserTable = new botbuilder_azure.AzureBotStorage({gzipData: false}, AzureTableClient)

let tableService: azureStorage.TableService = azureStorage.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
let entGen = azureStorage.TableUtilities.entityGenerator;
let time = Date.now();
let now = time.toString();
//=========================================================
// Bot Config
//=========================================================

let bot: builder.UniversalBot = new builder.UniversalBot(connector).set('storage', UserTable);
bot.localePath(path.join(__dirname, './locale'));

//=========================================================
// Universal Functions
//=========================================================

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

function LocationAddressFomater (address: string): string
{
    let addressSplit: string[] = address.split(" ");
    let formattedAddress: string = '';

    for (let index: number = 0; index < addressSplit.length; index++)
    {
        formattedAddress += (addressSplit[index]);

        if (index < addressSplit.length - 1)
        {
            formattedAddress += '%20';
        }

        else
        {
            // add nothing 
            continue;
        }
    }

    return formattedAddress;
}
function PhoneStrip(phone: string): string
{
    let finalPhone: string = '';
    for (let index = 0; index < phone.length; index++) 
    {
        if (phone[index] == "-")
        {
            continue;
        }
        else
        {
            finalPhone += phone[index]
        }
    }

    return finalPhone;
}

//=========================================================
// Trigger Dialogs
//=========================================================
bot.dialog("/cancel", [
    function (session: builder.Session)
    {
        session.endConversation("Thank you for using Travelr!")
    }
]).triggerAction({
    confirmPrompt: "Are you sure you want to cancel?",
    matches: /^cancel/i,
})

bot.dialog("/recalculate", [
    function(session: builder.Session)
    {
        session.replaceDialog("/calculation");
    }
]).triggerAction({confirmPrompt:"Are you sure you want to rerun?", matches: [/^rerun/i, /^recalculate/i]})

bot.dialog("/help", [

    (session: builder.Session, args: builder.IActionRouteData, next: any) =>
    {
        builder.Prompts.choice(session, "What would you like help with?", ["Company Info", "Commands", "Finished"]);
    }, 

    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response)
        {
            if (results.response.index == 0)
            {
                session.beginDialog('/info');
                next();
            }
            else if (results.response.index == 1)
            {
                session.beginDialog('/commands');
                next();
            }
            else
            {
                session.endDialog("Leaving the help dialog and returning you to your step!");
            }
        }

    },

    (session: builder.Session) =>
    {
        session.replaceDialog('/help');
    }

]).triggerAction({
    matches: /^help/i,
    confirmPrompt: "Are you sure you want to launch the help dialog?",
    onSelectAction: (session, args: builder.IActionRouteData, next: any) => 
    {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        if(args.action)
        {
            session.beginDialog(args.action, args);
        }
        else
        {
            next();
        }
    } 
})
bot.beginDialogAction("repeatOptions", "/options", {})
bot.beginDialogAction("endConversation", "/end")
//=========================================================
// Bots Dialogs
//=========================================================
bot.dialog('/', [
    (session: builder.Session) =>
    {
        builder.Prompts.choice(session, "Hello and welcome to Travelr! What would you like to do?", ["Find Transportation", "Access Account", "Info/Help"])
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response)
        {
            if (results.response.index == 0) // find transportation
            {
                session.beginDialog("/main");
            }
            else if (results.response.index == 1) // access account 
            {
                session.beginDialog("/account");
            }
            else if (results.response.index == 2) 
            {
                session.beginDialog("/help");
            }
        }
    },
    (session: builder.Session) =>
    {
        session.replaceDialog('/');
    }
])
bot.dialog('/main', [

    // send the intro
    function (session: builder.Session, args: any, next: any): void
    {
        session.send("Great! We just need a few details to get you to your destination! You can say 'cancel' or 'restart' to redo your current step.");

        // Check to see if they are a registered user
        // If a known user with favorites launch the favorites dialog 
        if (session.userData.favoriteLocations)
        {
            console.log("Starting /favoriteLocations");
            session.replaceDialog("/favoriteLocations");
        }
        // if the user does not have favorites 
        else
        {
            console.log("Starting /customLocations");
            session.replaceDialog("/customLocations");
        }
        
    }
])

bot.dialog("/favoriteLocations", [

    // get the user's starting location
    function(session: builder.Session): void
    {   
        // Create a list of buttons for the favorites options
        let locationChoice: string[] = ["Custom"]

        // build the base location message for the favorites maps
        let locationMessage: builder.Message = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .addAttachment(new builder.HeroCard(session)
                .title("Custom")
                .subtitle("Select custom to enter a new address or location")
        );
        if (session.userData.phone && session.userData.pin)
        {
            let favoriteLocations = session.userData.favoriteLocations;
            
            for (let key in favoriteLocations)
            {
                // Add the key to the list of options
                locationChoice.push(key)

                // add an attachment to the hero card carousel
                locationMessage
                    .addAttachment(new builder.HeroCard(session)
                        .title(key)
                        .images([builder.CardImage.create(session, 
                            map_builder.map_image_location_builder(favoriteLocations[key].lat, 
                                favoriteLocations[key].long))]))
            }
            
        }
        session.send(locationMessage);
        builder.Prompts.choice(session, "You can enter a custom address or select one of your favorites", locationChoice);
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response)
        {
            if (results.response.index == 0) // if the user wants a custom location
            {
                builder.Prompts.text(session, "What is your starting location? (E.g. 22nd and Main Austin Texas or JKF Airport)");
            }
            else
            {
                // Find the key's pair 
                let favoriteLocations = session.userData.favoriteLocations;
                for (let key in favoriteLocations)
                {
                    if (key == results.response.entity)
                    {
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
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any)  =>
    {
        // Check to see if the information has been recieved
        // The user chose a custom address
        if (results.response)
        {
            console.log("Adding the information for custom information.")
            // set the start address name
            session.privateConversationData.start = results.response;

            // set the starting lat and long 
            // call the google maps function to get the session.privateConversationData 
            googleMapsClient.geocode({ address: session.privateConversationData.start}, function (err, response): void
            {
                if (!err)
                {   
                    // Get and save the latitude
                    session.privateConversationData.start_lat = response.json.results[0].geometry.location.lat

                    // get the longitude
                    session.privateConversationData.start_long = response.json.results[0].geometry.location.lng
                    
                    // send the location image in a message 
                    console.log("Building the location message");
                    let locationMessage: builder.Message = map_builder.map_card_builder(session, 
                    response.json.results[0].geometry.location.lat, 
                    response.json.results[0].geometry.location.lng);
                    locationMessage.text("Here is your custom starting location. You can say say 'restart' to re-enter if it is wrong");

                    console.log("Sending the location image message");
                    session.send(locationMessage); 
                }
                // if there is an error 
                else 
                {
                    // Call the error dialogue
                    console.log("There was an error getting your starting location");
                }
            })
        }

        console.log("Asking for destination");
        let locationChoice: string[] = ["Custom"]

        // build the base location message for the favorites maps
        let locationMessage: builder.Message = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .addAttachment(new builder.HeroCard(session)
                .title("Custom")
                .subtitle("Select custom to enter a new address or location")
        )
        
        //  Get the favorite locations
        let favoriteLocations = session.userData.favoriteLocations;
        
        // loop through each location and build out the buttons and hero card images
        for (let key in favoriteLocations)
        {
            locationChoice.push(key)

            // add an attachment to the hero card carousel
                locationMessage
                    .addAttachment(new builder.HeroCard(session)
                        .title(key)
                        .images([builder.CardImage.create(session, 
                            map_builder.map_image_location_builder(favoriteLocations[key].lat, 
                                favoriteLocations[key].long))]))
        } 
        session.send(locationMessage);
        builder.Prompts.choice(session, "Great! For your destination, you can enter a customer address or select one of your favorites", locationChoice);
         
    },

    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response)
        {
            if (results.response.index == 0) // if the user wants a custom location
            {
                builder.Prompts.text(session, "What is your destination? (E.g. 1600 Pennsylvania Avenue  or The Space Needle)");
            }
            else
            {
                // Find the key's pair 
                let favoriteLocations = session.userData.favoriteLocations;
                for (let key in favoriteLocations)
                {
                    if (key == results.response.entity)
                    {
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
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any)  =>
    {
        // Check to see if the information has been recieved
        if (results.response)
        {
            session.privateConversationData.end = results.response;

            // Get and set the lat and long for the destiation
            googleMapsClient.geocode({address: session.privateConversationData.end}, function (err, response)
            {
                if (!err)
                {
                    // get the latitutde
                    session.privateConversationData.end_lat = response.json.results[0].geometry.location.lat;

                    // get the longitude
                    session.privateConversationData.end_long = response.json.results[0].geometry.location.lng;

                    // send the location image in a message 
                    let locationMessage: builder.Message = map_builder.map_card_builder(session, 
                    response.json.results[0].geometry.location.lat, 
                    response.json.results[0].geometry.location.lng);

                    locationMessage.text("Here is your destination. Say 'restart' to re enter");

                    session.send(locationMessage);
                    
                    // Start the next dialog
                    session.beginDialog("/preferences");
                }

                // If there is an error
                else
                {
                    // call the error dialogue
                    // Unable to determine location
                    console.log("There was an error in getting destination");
                }
            })
        }

        // Start the next dialog if a favorite was chosen
        session.beginDialog("/preferences");
    }
]).reloadAction("reloadLocations", "Getting your location again", {
    matches: [/^restart/i, /^start over/i, /^redo/i]
})

bot.dialog('/customLocations', [
    (session: builder.Session) =>
    {
        builder.Prompts.text(session, "What is your starting location? (E.g. 22nd and Main Austin Texas or JKF Airport)");
    }, 
    (session: builder.Session, results: builder.IPromptTextResult, next: any) =>
    {
        // Check to see if the information has been recieved
        if (results.response)
        {
            session.privateConversationData.start = results.response;
        }

        // set the starting lat and long 
        // call the google maps function to get the session.privateConversationData 
        googleMapsClient.geocode({ address: session.privateConversationData.start}, function (err, response): void
        {
            if (!err)
            {   
                // Get and save the latitude
                session.privateConversationData.start_lat = response.json.results[0].geometry.location.lat

                // get the longitude
                session.privateConversationData.start_long = response.json.results[0].geometry.location.lng

                // send the location image in a message 
                let locationMessage: builder.Message = map_builder.map_card_builder(session, 
                response.json.results[0].geometry.location.lat, 
                response.json.results[0].geometry.location.lng);
                locationMessage.text("Here is your starting location. Say 'restart' to re enter");

                session.send(locationMessage);
                console.log("Asking for destination");
                
                builder.Prompts.text(session, "What is your destination? (E.g. 1600 Pennsylvania Avenue  or The Space Needle)"); 
            }
            // if there is an error 
            else 
            {
                // Call the error dialogue
                console.log("There was an error getting your starting location");
            }
        })
    }, 
    (session: builder.Session, results: builder.IPromptTextResult, next: any) =>
    {
        // Check to see if the information has been recieved
        if (results.response)
        {
            session.privateConversationData.end = results.response;
        }

        // Get and set the lat and long for the destiation
        googleMapsClient.geocode({address: session.privateConversationData.end}, function (err, response)
        {
            if (!err)
            {
                // get the latitutde
                session.privateConversationData.end_lat = response.json.results[0].geometry.location.lat;

                // get the longitude
                session.privateConversationData.end_long = response.json.results[0].geometry.location.lng;

                // send the location image in a message 
                let locationMessage: builder.Message = map_builder.map_card_builder(session, 
                response.json.results[0].geometry.location.lat, 
                response.json.results[0].geometry.location.lng);

                locationMessage.text("Here is your destination. Say 'restart' to re enter");

                session.send(locationMessage);
                
                // Start the next dialog
                session.beginDialog("/preferences");
            }

            // If there is an error
            else
            {
                // call the error dialogue
                // Unable to determine location
                console.log("There was an error in getting destination");
            }
        });
    }
])

bot.dialog('/preferences', [
    function (session: builder.Session, args, next: any)
    {   console.log("Getting user preference");
        builder.Prompts.choice(session, "What is your preference on transportation", ["Value", "Time", "luxury"]);
    },
    // Save the perference 
    function (session: builder.Session, result: builder.IPromptChoiceResult, next: any)
    {
        console.log("Determining result");
        if (result.response)
        {
            switch (result.response.index) 
            {
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
    function (session: builder.Session): void
    {
        builder.Prompts.choice(session, "How many people do you have?",
        "1-2|3-4|5+");
    },
    function (session: builder.Session, result: builder.IPromptChoiceResult,
    next: Function): void
    {
        if (result.response)
        {
            switch (result.response.index) 
            {
                case 0:
                    session.privateConversationData.group = 0;
                    break;
                case 1: 
                    session.privateConversationData.group = 1;
                    break;
                case 2:
                    session.privateConversationData.group = 2
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
})



bot.dialog('/calculation',[
//=========================================================
// Map information and Table Upload
//=========================================================

    // Begin processing the information
    function (session: builder.Session, args: any, next: any): void
    {
        session.send("Hold on while we get your results");

        // pull down the lats and long
        let start_lat: number = session.privateConversationData.start_lat;
        let end_lat: number = session.privateConversationData.end_lat;
        let start_long: number = session.privateConversationData.start_long;
        let end_long: number = session.privateConversationData.end_long;
        let start: string = session.privateConversationData.start;
        let end: string = session.privateConversationData.end;
        let phone: string = session.userData.phone;
        let pin: string = session.userData.pin;
        

        if (phone && pin) // they have an account
        {
            // Get there account information for visted locations
            let query = new azureStorage.TableQuery()
                .select(["Visited_Locations"])
                .where('PartitionKey eq ?', phone)
                .and("RowKey eq ?", pin);
            
            // Execute the query 
            tableService.queryEntities("User", query, null, (error, results, response) =>
            {
                if (error)
                {
                    console.log("Thee was an error seraching for the person");
                    console.log(error);
                }
                else
                {   
                    console.log("No errors commiting query");

                    if (results.entries.length == 0) // if there were no entries
                    {
                        console.log("Person was not found");
                    }
                    else
                    {
                        console.log(results.entries);
                        let visitedLocations = JSON.parse(results.entries[0].Visited_Locations._)
                        
                        visitedLocations[now] = 
                        {
                            start: 
                                {
                                    name: start,
                                    lat: start_lat,
                                    long: start_long
                                }, 
                                end:
                                {
                                    name: end, 
                                    lat: end_lat,
                                    long: end_long
                                }
                        }
                        // Send the users information to the cloud as a string
                        // Form the entity to be sent 
                        let updateUser = 
                        {
                            PartitionKey: entGen.String(phone),
                            RowKey: entGen.String(pin),
                            Visited_Locations: entGen.String(JSON.stringify(visitedLocations))
                        };
                        tableService.insertOrMergeEntity("User", updateUser, (error, result, response) =>
                        {
                            if (!error) 
                            {
                                console.log("User info updated on the table");
                            }
                            else 
                            {
                                console.log("There was an error adding the person: \n\n");
                                console.log(error);
                            }
                        })   
                    }
                }
            })

                
        }

        // Build the message for the locations
        let message = new builder.Message(session)
            .attachments([{
                contentType: "image/png",
                contentUrl: map_builder.map_image_route_builder(start_lat, start_long, end_lat, end_long)}])
            .text("Here is a map of you locations!");

        // Send the message
        session.send(message);

        // Log step to console
        console.log("Getting Google Transit informaiton")

        // Flags for finished api pulls
        let transitFlag: boolean = false;
        let uberFlag: boolean = false;
        let lyftFlag: boolean = false;

//=========================================================
// Google Transit
//=========================================================

        let transitUrl: string = 'https://maps.googleapis.com/maps/api/directions/json?';
        let transitOrigin: string = '&origin=' + start_lat + ',' + start_long;
        let transitDestination: string = '&destination=' + end_lat + ',' + end_long;
        let transitMode: string = '&mode=transit';
        let transitLanguage: string = "&language=en";
        let transitUnits: string = '&units=imperial';
        let transitKey: string = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";

        let transitQuery = transitUrl + transitOrigin + transitDestination + transitMode + transitLanguage + transitUnits + 
            transitKey;

        let transitHeaders: request.Headers =
        {
            'Content-Type': 'application/json',
            'Accept-Language': 'en_EN'
        }; 

        let transitOptions: request.OptionsWithUrl = {

            url: transitQuery,
            headers: transitHeaders
        }

        // Send the request for transif information
        request(transitOptions,

            function(error, response, info)
            {
                // Check if Error
                if (error)
                {
                    // Send a message to indicate error 
                    console.log(error);
                    console.log("There was an error in google transit information");
                    session.send("There was an unknown error getting transit info");

                    // create the error code
                    let errorTransit: Transit.IFinalLegInfo = 
                    {
                        transitArrivalTime: "Error",
                        transitDepartureTime: "Error",
                        transitDistance: "Error",
                        transitDuration: "Error",
                        transitSteps: []
                    };

                    transitFlag = true;
                    session.privateConversationData.Transit = errorTransit;
                }
                else
                {   
                    console.log("No error in transit");

                    // Convert the string into json 
                    let body: Transit.IAllTransitInfo = JSON.parse(info);

                    if (body.status != "OK")
                    {
                        console.log("No transit in area");
                        session.send("Transit is not available in this area.");

                        // create the error code
                        let errorTransit: Transit.IFinalLegInfo = 
                        {
                            transitArrivalTime: "Error",
                            transitDepartureTime: "Error",
                            transitDistance: "Error",
                            transitDuration: "Error",
                            transitSteps: []
                        };

                        session.privateConversationData.Transit = errorTransit;
                        transitFlag = true;
                    }
                
                    else
                    {
                        console.log("Transit in area");
                        
                        for (let route_step: number = 0; route_step < body.routes.length; route_step++)
                        {
                            // Right now there is only 1 route
                            let legs: Transit.ILeg[] = body.routes[route_step].legs;

                            // loop through each leg
                            // Right now there is only 1 leg because there are no waypoints
                            legs.forEach(leg => 
                            {   
                                // Need to make sure that it is not only walking directions    
                                let transitLegInfo: Transit.IFinalLegInfo;

                                if (leg.steps.length == 1)
                                {
                                    let currentTime: number = Date.now()
                                    let departureTime: number = currentTime
                                    
                                    // Google Transit give time value in seconds
                                    // Muliply by 10 to get milliseconds to add to Date
                                    let arrivalTime : number = currentTime + (leg.duration.value * 10);

                                    // Convert the times into Date 
                                    let departureDate: Date = new Date(departureTime);
                                    let arrivalDate: Date = new Date(arrivalTime);

                                    transitLegInfo = 
                                    {
                                        transitArrivalTime: arrivalDate.getHours().toString() + (arrivalDate.getMinutes() < 10 ? ':0' : ':') + arrivalDate.getMinutes().toString(),
                                        transitDepartureTime: departureDate.getHours() + (departureDate.getMinutes() < 10 ? ":0" : ":") + departureDate.getMinutes(),
                                        transitDistance: leg.distance.text,
                                        transitDuration: leg.duration.text,
                                        transitSteps: [],
                                    };

                                }
                                else
                                {
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
                                let steps: Transit.IStep[] = leg.steps

                                steps.forEach(step => 
                                {
                                    if (step.travel_mode == "WALKING")
                                    {
                                        let walkingStepInfo: Transit.IStepWalkingInfo = 
                                        {
                                            stepDistance: step.distance.text,
                                            stepDuration: step.duration.text,
                                            stepMainInstruction: step.html_instructions,
                                            stepTransitMode: step.travel_mode,
                                            stepDeatiledInstructions: []
                                        };

                                        step.steps.forEach(detailedStep => 
                                        {
                                            let detailedStepInfo: Transit.IStepDetailedWalkingInfo =
                                            {
                                                stepDistance: detailedStep.distance.text,
                                                stepDuration: detailedStep.duration.text,
                                                stepMainInstruction: HtmlParse(detailedStep.html_instructions),
                                                stepTransitMode: detailedStep.travel_mode
                                            };

                                            // Add to Main step deailted instruction array 
                                            walkingStepInfo.stepDeatiledInstructions.push(detailedStepInfo);
                                        });
                                        
                                        // Add the step and instruction to the main leg info
                                        transitLegInfo.transitSteps.push(walkingStepInfo);
                                    }

                                    else //( step.travel_mode == "TRANSIT")
                                    {
                                        let transitStepInfo: Transit.IStepTransitInfo =
                                        {
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
                                        }

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
        const client_id: string =  '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP'; //process.env.UBER_APP_ID,
        const client_secret: string = 'vAy-juG54SV15yiv7hsDgVMegvMDPbjbtuayZ48a';//process.env.UBER_APP_PASSWORD,
        let server_token: string = 'CSQlbbbn6k0gbYZULEqiLk0cwUy03ZIPkIYxPrOs'; //process.env.UBER_APP_TOKEN,
        const perference: number = session.privateConversationData.perference; 
        const group: number = session.privateConversationData.group;
        let rides: Uber.ISelectedRides[] = [];

        // Send the request for products
        // This is where we will check for seat capcaity and or luxury options
        // This is mainly to exclude certain options, not to include
        let headers: request.Headers =
        {
            'Authorization': 'Token ' + server_token,
            'Content-Type': 'application/json',
            'Accept-Language': 'en_EN'
        }; 

        let options: request.OptionsWithUrl = {

            url: 'https://api.uber.com/v1.2/products?latitude=' + start_lat +  '&longitude=' + start_long,
            headers: headers
        }

        request(options, function(error, response, info: string): void
        {
            if (error || response.statusCode == 400)
            {
                // TODO: skip over uber
                console.log("Error when getting uber info")
                console.log(error);
                console.log(response.statusCode);

                let best_uber_option: Uber.IBestOption =
                {
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

            // If they were able to find the products
            else
            {
                let body: Uber.IProducts = JSON.parse(info);
                console.log("Got Uber Product info");

                for (let index: number = 0; index < body.products.length; index++) 
                {
                    let ride: Uber.IProductsInfo = body.products[index];

                    if (perference == 2)
                    {
                        if (ride.display_name == "SELECT" || ride.display_name == "BLACK" || ride.display_name == "SUV")
                        {
                            if (group == 0)
                            {

                            }
                            else if (group == 1)
                            {
                                if (ride.capacity > 4)
                                {
                                    rides.push({display_name: ride.display_name});
                                }
                            }
                            else if (group == 2)
                            {
                                if (ride.capacity < 5)
                                {
                                    rides.push({display_name: ride.display_name});
                                }
                            }
                            
                        }
                    }
                    else
                    {
                        if (group == 0)
                        {
                            rides.push({display_name: ride.display_name});
                            continue;
                        }
                        else if (group == 1)
                        {
                            if (ride.capacity > 2)
                            {
                                rides.push({display_name: ride.display_name});
                                continue;
                            }
                        }
                        else if (group == 2)
                        {
                            if (ride.capacity > 4)
                            {
                                rides.push({display_name: ride.display_name});
                                continue;
                            }
                        }
                    }
                }

                // Send the request for Prices
                // Set the headers 
                headers ={
                    'Authorization': 'Token ' + server_token,
                    'Content-Type': 'application/json',
                    'Accept-Language': 'en_EN'
                }

                // Set the options 
                options = {
                    url: 'https://api.uber.com/v1.2/estimates/price?start_latitude=' + start_lat + '&start_longitude=' + start_long + '&end_latitude=' + end_lat + '&end_longitude=' + end_long,
                    method: 'GET',
                    headers: headers
                };

                // Make the request 
                request(options, function(error, response, info: string)
                {
                    // Send the uber information to the cloud as a string
                    // Form the entity to be sent 
                    let UberJson = 
                    {
                        PartitionKey: entGen.String('Uber'),
                        RowKey: entGen.String(session.message.user.id + ":" + now),
                        Rideshare: entGen.String(info),
                        Start_Lat: start_lat,
                        Start_Long: start_long, 
                        End_Lat: end_lat,
                        End_Long: end_long
                    };
                    tableService.insertEntity("Rideshare", UberJson, (error, result, response) =>
                    {
                        if (!error) 
                        {
                            console.log("Uber Info added to Table");
                        }
                        else 
                        {
                            console.log("There was an error adding the person: \n\n");
                            console.log(error);
                        }
                    })

                    // Convert the string into JSON
                    let body: Uber.IUberPrices = JSON.parse(info);
                    console.log(body);

                    let product: Uber.IUberProductPrices[] = [];

                    // Set variables to hold the infomration
                    let uber_price: number = 99999;
                    let best_uber_option: Uber.IBestOption = 
                    {
                        uber_distance: 0,
                        uber_driver_time: 0, 
                        uber_name: "",
                        uber_price: 0,
                        uber_productId: "",
                        uber_travel_time: 0
                    };

                    // Check to see if error 
                    if (error || response.statusCode == 400)
                    {
                        // Log the error
                        console.log(error);
                        console.log(response.statusCode);
                        console.log("Not able to find pricing info")
                        let best_uber_option: Uber.IBestOption =
                        {
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

                    else
                    {
                        console.log("Have Uber prices");

                        // Loop through each ride and match with product information 
                        for (let index: number = 0; index < body.prices.length; index++)
                        {
                            let ride: Uber.IUberProductPrices = body.prices[index];

                            // Check to see if the product matches the terms already
                            for (let e: number = 0; e < rides.length; e++)
                            {
                                if (ride.display_name == rides[e].display_name)
                                {
                                    // Add the price info to the product array
                                    product.push(ride);
                                }
                            }
                            
                        }

                        // Now compare and find the cheapest price 
                        for (let index: number = 0; index < product.length; index++)
                        {
                            // Create a holding variable
                            let ride: Uber.IUberProductPrices = product[index];

                            // If index is 0 set the base price to that index
                            if (index == 0)
                            {
                                // Change the pricing informaiton
                                uber_price = ride.high_estimate;

                                // Set the variable
                                best_uber_option = {

                                    uber_distance: ride.distance, 
                                    uber_driver_time: 0,
                                    uber_name: ride.display_name,
                                    uber_price: (ride.high_estimate + ride.low_estimate)/2,
                                    uber_productId: ride.product_id,
                                    uber_travel_time: ride.duration
                                }
                            }

                            if (uber_price > ride.high_estimate)
                            {
                                uber_price = ride.high_estimate;

                                // Set the variable
                                best_uber_option = {

                                    uber_distance: parseFloat(ride.display_name), 
                                    uber_driver_time: 0,
                                    uber_name: ride.display_name,
                                    uber_price: (ride.high_estimate + ride.low_estimate)/2,
                                    uber_productId: ride.product_id,
                                    uber_travel_time: ride.duration
                                }
                            }
                        }

                        // Send the request for Times
                        // Set the headers 
                        headers ={
                            'Authorization': 'Token ' + server_token,
                            'Content-Type': 'application/json',
                            'Accept-Language': 'en_EN'
                        };

                        // Set the options 
                        options  = {
                            url: 'https://api.uber.com/v1.2/estimates/time?start_latitude=' + start_lat + '&start_longitude=' + start_long + '&product_id=' + best_uber_option.uber_productId,
                            method: 'GET',
                            headers: headers
                        };

                        // Send the request for the time
                        request(options, function(error, response: request.RequestResponse, info)
                        {
                            // Parse the string into json
                            let body: Uber.DriverTime = JSON.parse(info);

                            if (error || response.statusCode != 200 || body.times.length == 0)
                            {
                                console.log(error); 
                                console.log(response.statusCode);
                                console.log(info);
                                console.log("Unable to find drivers");

                                let best_uber_option: Uber.IBestOption =
                                {
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
                            else
                            {
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
        let lyftClientId: string = 'gAAAAABZIPjkPxmPgs83bWslOmxyt26-4AFcNDYZOwXWj4gyu7NEjddtxNK0DeNOqRrIsOCjKF-16_NiqApbMT-5vtGXJaulRmRk6b6QqDpYyU0MGYojno-FKnn58KzWRPwfoqFF8MUA5LTP0FpoNScafNXOeSgdic1eWsoGQm6Kg5c7TyQviRQ=';

        let lyftHeaders: request.Headers = 
        {
            'Authorization': 'bearer ' + lyftClientId
        };

        let lyftOptions: request.OptionsWithUrl = 
        {
            url: 'https://api.lyft.com/v1/ridetypes?lat=' + start_lat + '&lng=' + start_long,
            headers: lyftHeaders
        }

        // Holds the type of rides that fits the user profile
        // Luxury and Group
        let lyftRideTypes: Lyft.ISelectedRideTypes[] = [];

        // Hold the Rides that fit the time 
        let lyftRides: Lyft.IRideEstimate[] = [];

        // Send the request to lyft for products
        // Find the best value
        request(lyftOptions, function(error, response: request.RequestResponse, info: any)
        {
                if (error || response.statusCode != 200)
                {
                    console.log(error);
                    console.log(response.statusCode);
                    console.log("Cannot find products");
                    
                    let best_lyft_option: Lyft.IBestLyftOption = 
                    {
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
            else
            {
                console.log("In lyft Ride Types");

                let body: Lyft.IAllRideTypes = JSON.parse(info);

                for (let index: number = 0; index < body.ride_types.length; index++)
                {
                    let ride: Lyft.IRideTypeInfo = body.ride_types[index];

                    if (perference == 2)
                    {
                        if (ride.display_name == "Lyft Premier" || ride.display_name == "Lyft Lux" || ride.display_name == "Lyft Lux SUV") 
                        {
                            if (group == 0)
                            {
                                lyftRideTypes.push({
                                    ride_type: ride.ride_type,
                                    display_name: ride.display_name
                                });

                                continue;
                            }
                            else if (group == 1)
                            {
                                if (ride.seats > 2)
                                {
                                    lyftRideTypes.push({
                                        ride_type: ride.ride_type,
                                        display_name: ride.display_name
                                    });

                                    continue;
                                }
                            }
                            else if (group == 2)
                            {
                                if (ride.seats > 4)
                                {
                                    lyftRideTypes.push({
                                        ride_type: ride.ride_type,
                                        display_name: ride.display_name
                                    });

                                    continue;
                                }
                            }
                        }
                    }

                    else // if the preference is not luxury
                    {
                        if (group == 0)
                        {
                            lyftRideTypes.push({
                                ride_type: ride.ride_type,
                                display_name: ride.display_name
                            });

                            continue;
                        }
                        else if (group == 1)
                        {
                            if (ride.seats > 2)
                            {
                                lyftRideTypes.push({
                                    ride_type: ride.ride_type,
                                    display_name: ride.display_name
                                });

                                continue;
                            }
                        }
                        else if (group == 2)
                        {
                            if (ride.seats > 4)
                            {
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
                let lyftHeaders: request.Headers = 
                {
                    'Authorization': 'bearer ' + lyftClientId
                };

                let lyftOptions: request.OptionsWithUrl = 
                {
                    url: 'https://api.lyft.com/v1/cost?start_lat='+ start_lat + '&start_lng=' + start_long + '&end_lat=' + end_lat + '&end_lng=' + end_long,
                    headers: lyftHeaders
                }

                // Send the request
                request(lyftOptions, function(error, response, info:string)
                {
                    if (error || response.statusCode == 400)
                    {   
                        console.log(error);
                        console.log(response.statusCode)
                        let best_lyft_option: Lyft.IBestLyftOption = 
                        {
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

                    else
                    {   
                        console.log("Have lyft prices");

                        // Send the uber information to the cloud as a string
                        // Form the entity to be sent 
                        let LyftJson = 
                        {
                            PartitionKey: entGen.String('Lyft'),
                            RowKey: entGen.String(session.message.user.id + ":" + now),
                            Rideshare: entGen.String(info),
                            Start_Lat: start_lat,
                            Start_Long: start_long, 
                            End_Lat: end_lat,
                            End_Long: end_long
                        };
                        tableService.insertEntity("Rideshare", LyftJson, (error, result, response) =>
                        {
                            if (!error) 
                            {
                                console.log("Uber Info added to Table");
                            }
                            else 
                            {
                                console.log("There was an error adding the person: \n\n");
                                console.log(error);
                            }
                        })

                        let body: Lyft.IAllEstimates = JSON.parse(info);
                        console.log(body);

                        // Lyft prices
                        let lyft_price: number = 99999;
                        let best_lyft_option: Lyft.IBestLyftOption = 
                        {
                            ride_type: "",
                            estimated_duration_seconds: 0,
                            estimated_distance_miles: 0,
                            price : 0,
                            primetime_percentage: "",
                            driver_time: 0,
                            display_name: ""
                        };

                        // Loop through each ride and match with previous information
                        for (let index: number = 0; index < body.cost_estimates.length; index++)
                        {
                            let ride: Lyft.IRideEstimate = body.cost_estimates[index];

                            // Check to see if it matches the one based on group and luxury
                            for (let e: number = 0; e < lyftRideTypes.length; e++)
                            {
                                if (ride.display_name == lyftRideTypes[e].display_name)
                                {
                                    // add the price infor to the product array 
                                    lyftRides.push(ride);
                                }
                            }
                        }

                        // Compares and find the cheapest price 
                        for (let index: number = 0; index < lyftRides.length; index++)
                        {
                            // Holding variable to reference the ride
                            let ride: Lyft.IRideEstimate = lyftRides[index];

                            // If index = 0 set the initial info to that
                            if (index == 0)
                            {
                                lyft_price = ride.estimated_cost_cents_max;
                                best_lyft_option = {
                                    display_name: ride.display_name,
                                    price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 200),
                                    estimated_distance_miles: ride.estimated_distance_miles,
                                    estimated_duration_seconds: ride.estimated_duration_seconds,
                                    primetime_percentage: ride.primetime_percentage,
                                    ride_type: ride.ride_type,
                                    driver_time: 0
                                }
                            } 

                            // If the ride is cheaper than the previous
                            if (ride.estimated_cost_cents_max < lyft_price)
                            {
                                lyft_price = ride.estimated_cost_cents_max;
                                best_lyft_option = {
                                    display_name: ride.display_name,
                                    price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 200),
                                    estimated_distance_miles: ride.estimated_distance_miles,
                                    estimated_duration_seconds: ride.estimated_duration_seconds,
                                    primetime_percentage: ride.primetime_percentage,
                                    ride_type: ride.ride_type,
                                    driver_time: 0
                                }
                            }
                            
                        }

                        // Send the new request for Driver Times
                        let lyftHeaders: request.Headers = 
                        {
                            'Authorization': 'bearer ' + lyftClientId
                        };

                        let lyftOptions: request.OptionsWithUrl = 
                        {
                            url: 'https://api.lyft.com/v1/eta?lat=' + start_lat + '&lng=' + start_long + '&ride_type=' + best_lyft_option.ride_type,
                            headers: lyftHeaders
                        }

                        // Send the request for Driver times
                        request(lyftOptions, function(error, response, info: string)
                        {
                            if (error || response.statusCode == 400)
                            {
                                console.log(error);
                                console.log(response.statusCode);
                                let best_lyft_option: Lyft.IBestLyftOption = 
                                {
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
                            
                            else
                            {
                                // Parse the JSON
                                let body: Lyft.AllEtas = JSON.parse(info);

                                // Set the Driver time
                                best_lyft_option.driver_time = body.eta_estimates[0].eta_seconds;

                                // Save the info to user data
                                session.privateConversationData.Lyft = best_lyft_option;
                                
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
        function Timeout(transit: boolean, uber: boolean, lyft: boolean, next: Function) {
                if (transit && uber && lyft) 
                {
                    // Go to the aggregations
                    return next();
                }
                else 
                {
                    setTimeout(function () 
                    {
                        console.log("Waiting for information");
                        return Timeout(transitFlag, uberFlag, lyftFlag, next);
                    }, 150);
                }
            };

            Timeout(transitFlag, uberFlag, lyftFlag, next);
    },
//=========================================================
// Match with user perferences 
//=========================================================
    function (session: builder.Session, response: any, next: Function)
    {
        console.log("Matching with user preference");

        // Grab the user preference
        let preference: number = session.privateConversationData.perference;

        // Grab the infomation
        let uber: Uber.IBestOption = session.privateConversationData.Uber;
        let lyft: Lyft.IBestLyftOption = session.privateConversationData.Lyft;
        let transitInfo: Transit.IFinalLegInfo = session.privateConversationData.Transit;
        let rideshare: Results.IRideshare = 
        {
            driverTime: "Error",
            price: 'Error',
            serviceProvider: "Error",
            serviceType: "Error",
            totalDistance: "Error",
            totalTime: "Error" ,
            proudctId: "Error"           
        };

        console.log(uber);
        console.log(lyft);

        // If there is an error at all
        if (uber.uber_name == "Error" || lyft.display_name == "Error")
        {
            // If uber and not lyft
            if (uber.uber_name == "Error" && lyft.display_name != "Error")
            {
                rideshare = 
                {
                    driverTime: (lyft.driver_time / 60).toFixed(2),
                    price : lyft.price.toFixed(2),
                    serviceProvider: "Lyft",
                    serviceType : lyft.display_name,
                    totalDistance : lyft.estimated_distance_miles.toFixed(2),
                    totalTime : (lyft.estimated_duration_seconds / 60).toFixed(2),
                    proudctId: lyft.ride_type

                }
            }

            // If lyft and not uber
            else if (uber.uber_name != "Error" && lyft.display_name == "Error")
            {
                rideshare =
                {
                    driverTime: (uber.uber_driver_time / 60).toFixed(2),
                    price : uber.uber_price.toFixed(2),
                    serviceProvider: "Uber",
                    serviceType : uber.uber_name,
                    totalDistance : uber.uber_distance.toFixed(2),
                    totalTime : (uber.uber_travel_time / 60).toFixed(2),
                    proudctId: uber.uber_productId
                };
            }

            // If both
            else
            {
                // Rideshare remains the same
                
            }
        }
        // If the preference is for value
        else if (preference == 0)
        {
            
            let uberPrice: number = uber.uber_price;
            let lyftPrice: number = lyft.price;

            // Find the lower price
            if (uberPrice < lyftPrice)
            {   
                rideshare =
                {
                    driverTime: (uber.uber_driver_time / 60).toFixed(2),
                    price : uberPrice.toFixed(2),
                    serviceProvider: "Uber",
                    serviceType : uber.uber_name,
                    totalDistance : uber.uber_distance.toFixed(2),
                    totalTime : (uber.uber_travel_time / 60).toFixed(2),
                    proudctId: uber.uber_productId
                };

            }
            else
            {
                rideshare =
                {
                    driverTime: (lyft.driver_time / 60).toFixed(2),
                    price : lyft.price.toFixed(2),
                    serviceProvider: "Lyft",
                    serviceType : lyft.display_name,
                    totalDistance : lyft.estimated_distance_miles.toFixed(2),
                    totalTime : (lyft.estimated_duration_seconds / 60).toFixed(2),
                    proudctId: lyft.ride_type
                };

            }
        }

        // If preference is for time
        else if (preference == 1)
        {
            let uberDriverTime: number = uber.uber_driver_time;
            let lyftDriverTime: number = lyft.driver_time;

            if (uberDriverTime < lyftDriverTime)
            {
                rideshare =
                {
                    driverTime: (uber.uber_driver_time / 60).toFixed(2),
                    price : uber.uber_price.toFixed(2),
                    serviceProvider: "Uber",
                    serviceType : uber.uber_name,
                    totalDistance : uber.uber_distance.toFixed(2),
                    totalTime : (uber.uber_travel_time / 60).toFixed(2),
                    proudctId: uber.uber_productId
                };
            }
            else
            {
                rideshare =
                {
                    driverTime: (lyft.driver_time / 60).toFixed(2),
                    price : lyft.price.toFixed(2),
                    serviceProvider: "Lyft",
                    serviceType : lyft.display_name,
                    totalDistance : lyft.estimated_distance_miles.toFixed(2),
                    totalTime : (lyft.estimated_duration_seconds / 60).toFixed(2),
                    proudctId: lyft.ride_type
                };
            }
        }

        // Preference is for luxury
        else if (preference == 2)
        {
            let uberPrice: number = uber.uber_price;
            let lyftPrice: number = lyft.price;

            // Find the lower price
            if (uberPrice < lyftPrice)
            {   
                rideshare =
                {
                    driverTime: (uber.uber_driver_time / 60).toFixed(2),
                    price : uberPrice.toFixed(2),
                    serviceProvider: "Uber",
                    serviceType : uber.uber_name,
                    totalDistance : uber.uber_distance.toFixed(2),
                    totalTime : (uber.uber_travel_time / 60).toFixed(2),
                    proudctId: uber.uber_productId
                };

            }
            else
            {
                rideshare =
                {
                    driverTime: (lyft.driver_time / 60).toFixed(2),
                    price : lyft.price.toFixed(2),
                    serviceProvider: "Lyft",
                    serviceType : lyft.display_name,
                    totalDistance : lyft.estimated_distance_miles.toFixed(2),
                    totalTime : (lyft.estimated_duration_seconds / 60).toFixed(2),
                    proudctId: lyft.ride_type
                };

            }
        }
////////////////////////////////////////////
//                                       //
//          BUILD THE MESSAGES           //   
//                                       //
///////////////////////////////////////////
        if (session.message.source != 'skype')
        {
            // Build the transit string 
            let transitMessage: any[] = [];
            // Check to see if there is an error with the ridesharing 
            let rideshareMessage: any[] = [];
            
            if (transitInfo.transitDistance == "Error")
            {
                console.log("Building the transit error message");
                transitMessage = 
                [
                    {   "type": "TextBlock",
                        "text": "Transit Not Found",
                        "size": "medium",
                        "weight": "bolder"
                    }
                ]                   
            }
            else
            {   console.log("Building the transit message");
                transitMessage = 
                [
                    {   "type": "TextBlock",
                        "text": "Transit",
                        "size": "medium",
                        "weight": "bolder"
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Departure Time: ${transitInfo.transitDepartureTime}`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Arrival Time: ${transitInfo.transitArrivalTime}`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Distance: ${transitInfo.transitDistance} miles`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Duration: ${transitInfo.transitDuration}`
                    }
                ]
            }


            if (rideshare.serviceType == "Error")
            {
                console.log("Building the rideshare error message");
                rideshareMessage = 
                [
                    {
                        "type": "TextBlock",
                        "text": "Rideshare Not Found",
                        "size": "medium",
                        "weight": "bolder"
                    }
                ]
            }
            else
            {
                console.log("Building the rideshare message");
                rideshareMessage = 
                [
                    {   "type": "TextBlock",
                        "text": "Rideshare",
                        "size": "medium",
                        "weight": "bolder"
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Service: ${rideshare.serviceProvider}`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Ride Type: ${rideshare.serviceType}`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Price: $${rideshare.price}`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Driver Distance: ${rideshare.driverTime} minutes away`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Total Distance: ${rideshare.totalDistance} miles`
                    },
                    {
                        "type": "TextBlock",
                        "text": `- Total Duration: ${rideshare.totalTime} minutes`
                    }
                ]
            }
            // Send the master message
            console.log("Building the master message");

            let masterMessage = new builder.Message(session)
                .addAttachment({
                    contentType: "application/vnd.microsoft.card.adaptive",
                    content: {
                        type: 'AdaptiveCard',
                        body: [
                                    {
                                    "type": "Container",
                                    "separation": "default",
                                    "items":[
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
                        })

            session.send(masterMessage);
        }

        else // the message is for skype
        {
            // Build the transit string 
            let transitString: string;
            
            if (transitInfo.transitDistance == "Error")
            {   
                console.log("Building skype error string");
                transitString = 'We could not find transit in this area <br/> <br/>';
            }
            else
            {
                // Build out the strings
                console.log("Building transit string");

                transitString = `Transit <br/>
                - Departure Time: ${transitInfo.transitDepartureTime} <br/>
                - Arrival Time: ${transitInfo.transitArrivalTime} <br/>
                - Distance: ${transitInfo.transitDistance} miles <br/>
                - Duration ${transitInfo.transitDuration} minutes <br/>`;
            }
            
            // Check to see if there is an error with the ridesharing 
            let rideshareString: string;

            if (rideshare.serviceType == "Error")
            {   
                console.log("Building rideshare error string");

                rideshareString = "We could not find any rideharing options";
            }
            else
            {
                console.log("Building rideshare string");
                
                rideshareString = `Rideshare <br/>
                - Service: ${rideshare.serviceProvider} <br/>
                - Ride Type: ${rideshare.serviceType} <br/>
                - Price: ${rideshare.price} <br/>
                - Driver Distance: ${rideshare.driverTime} minutes away <br/>
                - Total Distance: ${rideshare.totalDistance} miles <br/>
                - Total Duration: ${rideshare.totalTime} minutes <br/>`;
            }
            

            session.send(transitString + rideshareString);
        }
        
        // Add the options to the privateConversationData
        session.privateConversationData.Rideshare = rideshare;

        session.replaceDialog("/options");

    } 
])


// Dialogue for infomation 
bot.dialog("/options", [

    function (session: builder.Session): void
    {
        builder.Prompts.choice(session, "Type the number or name to order or get more info or hit finished",
        ["Transit", 'Rideshare', "Finished"]);
    }, 

    function(session: builder.Session, response: builder.IPromptChoiceResult, next)
    {
        // Get the transit and rideshare options 
        let transit: Transit.IFinalLegInfo = session.privateConversationData.Transit;
        let rideshare: Results.IRideshare = session.privateConversationData.Rideshare;
        let startLat: string = session.privateConversationData.start_lat;
        let startLong: string = session.privateConversationData.start_long;
        let endLat: string = session.privateConversationData.end_lat; 
        let endLong: string = session.privateConversationData.end_long;

        if (response.response)
        {
            // User wants to see transit information
            if (response.response.index == 0)
            {
                if (transit.transitArrivalTime == "Error")
                {
                    session.send("There was an error when looking for transit in your locations.")
                }
                else
                {
                    if (session.message.source != 'skype')
                    {
                        // Array to Hold all direction string 
                        let stepMessage: any[] = [];

                        for (let step: number = 0; step < transit.transitSteps.length; step++) 
                        {
                            // Check to see if walking or transit step
                            if ( transit.transitSteps[step].stepTransitMode == "WALKING")
                            {
                                let walkingStep: Transit.IStepWalkingInfo = transit.transitSteps[step] as Transit.IStepWalkingInfo;

                                let instructions = 
                                [
                                    {
                                        "type": "TextBlock",
                                        "text": `${walkingStep.stepMainInstruction}`,
                                        "size": "medium",
                                        "weight": "bolder",
                                        "wrap": true

                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Distance: ${walkingStep.stepDistance}`,
                                        "wrap": true
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Duration: ${walkingStep.stepDuration}`,
                                        "wrap": true
                                    }
                                ]


                                for (let step: number = 0; step < walkingStep.stepDeatiledInstructions.length; step++)
                                {
                                    if (step == walkingStep.stepDeatiledInstructions.length - 1)
                                    {
                                        instructions.push(
                                            {
                                                "type": "TextBlock",
                                                "text": `- Step ${step + 1}: ${walkingStep.stepDeatiledInstructions[step].stepMainInstruction}`,
                                                "wrap": true   
                                            }
                                        );
                                    }
                                    else
                                    {
                                        instructions.push(
                                            {
                                                "type": "TextBlock",
                                                "text": `- Step ${step + 1}: ${walkingStep.stepDeatiledInstructions[step].stepMainInstruction}` ,
                                                "wrap": true  
                                            });
                                    }
                                }

                                instructions.forEach(step => {
                                    stepMessage.push(step);
                                });
                            }

                            else
                            {
                                let transitStep: Transit.IStepTransitInfo = transit.transitSteps[step] as Transit.IStepTransitInfo;
                                let transitMessage: any[] = 
                                [
                                    {
                                        "type": "TextBlock",
                                        "text": `${transitStep.stepMainInstruction}`,
                                        "size": "medium",
                                        "weight": "bolder",
                                        "wrap": true   

                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Depature Name: ${transitStep.departureStopName}`,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Deapture Time: ${transitStep.departureStopTime}`,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Arrival Name: ${transitStep.arrivalStopName}`,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Arrival Time: ${transitStep.arrivalStopTime}`,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Distance: ${transitStep.stepDistance} miles`,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Duration: ${transitStep.stepDuration} minutes`,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Number of Stops: ${transitStep.numberOfStop}`,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Vehicle Name: ${transitStep.vehicleName} `,
                                        "wrap": true  
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": `- Vehicle Type: ${transitStep.vehicleType}`,
                                        "wrap": true  
                                    }
                                ];

                                transitMessage.forEach(step => {
                                    stepMessage.push(step);
                                })

                            }
                        }

                        // Build the step by step directions
                        let directionMessage: builder.Message = new builder.Message(session)
                            .addAttachment({
                                contentType: "application/vnd.microsoft.card.adaptive",
                                content: 
                                {
                                    type: 'AdaptiveCard',
                                    body: 
                                    [
                                        {
                                            "type": "Container",
                                            "separation": "default",
                                            "items":
                                            [
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
                                            "items": stepMessage
                                        }
                                                
                                    ]   
                                }
                            })

                        session.send(directionMessage);

                        // repeat the dialog
                        session.replaceDialog('/options');
                    }

                    else // if the user is using skype
                    {
                        // Array to Hold all direction string 
                        let directions: string = "";

                        for (let step: number = 0; step < transit.transitSteps.length; step++) 
                        {
                            // Check to see if walking or transit step
                            if ( transit.transitSteps[step].stepTransitMode == "WALKING")
                            {
                                let walkingStep: Transit.IStepWalkingInfo = transit.transitSteps[step] as Transit.IStepWalkingInfo;

                                directions += `${walkingStep.stepMainInstruction} <br/> 
                                - Distance: ${walkingStep.stepDistance} <br/>
                                - Duration: ${walkingStep.stepDuration} <br/>
                                `;

                                for (let step: number = 0; step < walkingStep.stepDeatiledInstructions.length; step++)
                                {
                                    if (step == walkingStep.stepDeatiledInstructions.length - 1)
                                    {
                                        directions += `- Step ${step + 1}: ${walkingStep.stepDeatiledInstructions[step].stepMainInstruction} <br/>`;
                                    }
                                    else
                                    {
                                        directions += `- Step ${step + 1}: ${walkingStep.stepDeatiledInstructions[step].stepMainInstruction} <br/> 
                                        `;
                                    }
                                }
                            }

                            else
                            {
                                let transitStep: Transit.IStepTransitInfo = transit.transitSteps[step] as Transit.IStepTransitInfo;
                                
                                directions += `${transitStep.stepMainInstruction} <br/>
                                - Depature Name: ${transitStep.departureStopName} <br/>
                                - Deapture Time: ${transitStep.departureStopTime} <br/>
                                - Arrival Name: ${transitStep.arrivalStopName} <br/>
                                - Arrival Time: ${transitStep.arrivalStopTime} <br/>
                                - Distance: ${transitStep.stepDistance} miles <br/>
                                - Duration: ${transitStep.stepDuration} minutes <br/>
                                - Number of Stops: ${transitStep.numberOfStop} <br/>
                                - Vehicle Name: ${transitStep.vehicleName} <br/>
                                - Vehicle Type: ${transitStep.vehicleType} <br/>`
                            }
                        }

                        session.send(directions);

                        // repeat the dialog
                        session.replaceDialog('/options');
                    }

                    
                }
            }

            // User want ridesharing information
            else if (response.response.index == 1)
            {
                // Check the rideshare service provider
                if (rideshare.serviceProvider == "Uber")
                {
                    if (session.message.source != 'skype')
                    {
                        let uberClientId: string = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP' //process.env.UBER_APP_ID

                        // Format the addresses
                        let pickup: string = LocationAddressFomater(session.privateConversationData.start);
                        let dropoff: string = LocationAddressFomater(session.privateConversationData.end);


                        let uberString: string = `https://m.uber.com/ul/?action=setPickup&client_id=${uberClientId}&product_id=${rideshare.proudctId}&pickup[formatted_address]=${pickup}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&dropoff[formatted_address]=${dropoff}&dropoff[latitude]=${endLat}&dropoff[longitude]=${endLong}`;
                        
                        let uberCard: builder.Message = new builder.Message(session)
                            /*.addAttachment({
                                contentType: "application/vnd.microsoft.card.adaptive",
                                content:
                                {
                                    type: "AdaptiveCard",
                                    body:
                                    [
                                        {
                                            "type": "TextBlock",
                                            "text": "Click the image or link to open the app and order your ride!"
                                        },
                                        {
                                            "type": "Image",
                                            "url": 'https://d1a3f4spazzrp4.cloudfront.net/uber-com/1.2.29/d1a3f4spazzrp4.cloudfront.net/images/apple-touch-icon-144x144-279d763222.png',
                                            "size": "small",
                                            "selectAction": 
                                            {
                                                "type": "Action.OpenUrl",
                                                "title": "Order Uber",
                                                "url": uberString
                                            }
                                        }, 
                                        {
                                            "type": "Action.OpenUrl",
                                            "title": "Order an Uber",
                                            "url": uberString
                                        }
                                    ]
                                }
                            }) */
                            .addAttachment(
                                new builder.ThumbnailCard(session)
                                    .title("Order an Uber")
                                    .text("Click to order your Uber in the Uber App!")
                                    .images([builder.CardImage.create(session, 'https://d1a3f4spazzrp4.cloudfront.net/uber-com/1.2.29/d1a3f4spazzrp4.cloudfront.net/images/apple-touch-icon-144x144-279d763222.png')])
                                    .buttons([builder.CardAction.openUrl(session, uberString, "Order an Uber"),
                                    builder.CardAction.dialogAction(session, "repeatOptions", undefined, "Back to options" ),
                                    builder.CardAction.dialogAction(session, "endConversation", undefined, "Finish")])
                                    .tap(builder.CardAction.openUrl(session, uberString, "Order Uber"))
                                    )

                        session.send(uberCard);
                    }

                    else // if the client is skype
                    {
                        let uberClientId: string = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP' //process.env.UBER_APP_ID

                        // Format the addresses
                        let pickup: string = LocationAddressFomater(session.privateConversationData.start);
                        let dropoff: string = LocationAddressFomater(session.privateConversationData.end);

                        // Order the Uber
                        session.send("Click the link to open the app and order your ride!");

                        let uberString: string = `'https://m.uber.com/ul/?action=setPickup&client_id=${uberClientId}&product_id=${rideshare.proudctId}&pickup[formatted_address]=${pickup}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&dropoff[formatted_address]=${dropoff}&dropoff[latitude]=${endLat}&dropoff[longitude]=${endLong}`;
                        
                        session.send(uberString);
                    }
                        
            }   

                else if (rideshare.serviceProvider == 'Lyft')
                {
                    if (session.message.source != 'skype')
                    {
                        let clientId: string = '9LHHn1wknlgs';


                        // Order the Lyft
                        let lyftString: string = `https://lyft.com/ride?id=${rideshare.proudctId}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&partner=${clientId}&destination[latitude]=${endLat}&destination[longitude]=${endLong}`;

                        let lyftCard: builder.Message = new builder.Message(session)
                            /*.addAttachment({
                                contentType: "application/vnd.microsoft.card.adaptive",
                                content:
                                {
                                    type: "AdaptiveCard",
                                    body:
                                    [
                                        {
                                            "type": "TextBlock",
                                            "text": "Click the image or link to open the app and order your ride!"
                                        },

                                        {
                                            "type": "Image",
                                            "url": 'https://www.lyft.com/apple-touch-icon-precomposed-152x152.png',
                                            "size": "small",
                                            "selectAction": 
                                            {
                                                "type": "Action.OpenUrl",
                                                "title": "Order Lyft",
                                                "url": lyftString
                                            }
                                        }, 
                                        {
                                            "type": "Action.OpenUrl",
                                            "title": "Order an Lyft",
                                            "url": lyftString
                                        }
                                    ]
                                }
                            }) */
                        .addAttachment(new builder.ThumbnailCard(session)
                            .title("Order your Lyft!")
                            .text("Click the button to order your Lyft in the Lyft App!")
                            .subtitle("If on SMS say 'Order Lyft' to order the ride")
                            .images([builder.CardImage.create(session, "https://www.lyft.com/apple-touch-icon-precomposed-152x152.png")])
                            .tap(builder.CardAction.openUrl(session, lyftString, "Order Lyft"))
                            .buttons([builder.CardAction.openUrl(session, lyftString, "Order Lyft"), 
                                builder.CardAction.dialogAction(session, "repeatOptions", undefined , "Back to options"),
                                builder.CardAction.dialogAction(session, "endConversation", undefined, "Finish")]));

                        session.send(lyftCard);
                    }
                    else // The source is skype
                    {
                        let clientId: string = '9LHHn1wknlgs';
                        // Order the Lyft
                        session.send("Or click the link to open the app and order your ride!");
                        let lyftString: string = `https://lyft.com/ride?id=${rideshare.proudctId}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&partner=${clientId}&destination[latitude]=${endLat}&destination[longitude]=${endLong}`;
                        session.send(lyftString);
                    }
                }

                else // If there was on error
                {
                    session.send("We could not find any ridesharing options here");
                }
            }
            // User is done with the conversation
            else
            {
                session.endConversation("Thank you for using Travelr! Have a great day!");
            }
        }
                 
    }
]);

bot.dialog("/info", [
    function(session: builder.Session): void
    {
        builder.Prompts.choice(session, "What information would you like to see",
        "Company Info|Privacy|How It Works|Finished");
    },

    function(session:builder.Session, response:builder.IPromptChoiceResult, next: any)
    {
        if (response.response)
        {
            if(response.response.index == 0)
            {
                session.send(`Company Info
                
                Travelr is all about creating a more enjoyable commuting experience.
                
                We are your urban travel guide to make your daily commute better we match your preferences and find the best options 
                avialable for you including price, time, group size, and a luxurious option.

                By connecting users to one another we enhance the quality of everyone's dialy commute. This means that every user
                depending on their choice will be able to find the quickest route, the cheapest ride, or the best luxury deal available.`
                );
            }

            else if(response.response.index == 1)
            {
                session.send(`Privacy
                
                Retainment of information

                This bot is currently in beta. We do not ask for nor retain personal information including but not limited to: Name, DOB, Mailing or Biling Address, etc...
                Although, not yet implemented, Travelr does intend to eventually retain your starting location, destiantion, and the best services our system produces. 
                This information will eventually help us with creating a better and faster bot by allowing us to run analysis on the transportation systems in your geographic area.

                Sale of information

                We will not sell the retained informaiton. The informaiton will be used for our own purposes as stated above. We will update our privacy statements accordingly.`);
            }

            else if(response.response.index == 2)
            {
                session.send(`How It Works

                Travelr asks the user for their commuting preferences and then it asks the user for their starting and ending locations. After
                typing in their preferences and destination our algorithim internally finds the best choice for the user.`)
            }
            else
            {
                session.send("Returning you back to the help dialog!");
                session.endDialog();
            }
        
        }
        console.log("Going to the next step");
        next();

    },

    (session: builder.Session) =>
    {
        session.replaceDialog("/info");
    }

])

bot.dialog("/account", [
    (session, args, next) =>
    {
        console.log("Getting choice");
        builder.Prompts.choice(session, "Welcome to the account settings! Would you like to 'Sign Up', 'Login', 'Edit', or 'Cancel'?", ['Sign Up', 'Login', 'Edit', 'Cancel']);
    },

    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        console.log("Directing the choice")

        if (results.response)
        {
            if (results.response.index == 0) // Sign up
            {
                session.beginDialog('/signUp');
            }
            else if (results.response.index == 1) // login
            {
                session.beginDialog('/login');
            }
            else if (results.response.index == 2) // edit
            {
                session.beginDialog('/edit')
            }
            else if (results.response.index == 3) // cancel
            {
                session.endDialog("Okay returning you to the main menu!")
            }
        }

    },
    (session: builder.Session, results: builder.IDialogResult<any>, next: any) =>
    {
        if (results.resumed == builder.ResumeReason.completed)
        {
            session.replaceDialog('/');
        }
    } 
])

bot.dialog('/signUp', [
    function (session, args, next)
    {
        console.log("In the sign up dialog");
        console.log("Getting the users phone number");
        builder.Prompts.text(session, "Welcome to the sign up dialog! What is your phone number? Your phone number will become your ID.");
    },
    function (session, results, next)
    {
        console.log("Getting the user's pin")
        let phone = results.response.trim();
        let finalPhone = PhoneStrip(phone);

        session.userData.phone = finalPhone;
        builder.Prompts.text(session, "Great! Now we just need a custom pin. It can be of any length or combination!");
    },

    function (session, results, next)
    {
        console.log("Asking for add to favorites")
        session.userData.pin = results.response;
        builder.Prompts.choice(session, "Would you like to add your favorite places?", ["Yes", "No"])
    }, 

    function (session, results: builder.IPromptChoiceResult, next: any)
    {
        
        if (results.response && results.response.index == 0) // yes
        {   session.send("Awesome, starting the 'Add Favorites' dialog!");
            console.log("starting the add favorites dialog!")
            let response: builder.Session = session.beginDialog('/addFavorites');
        }
        else // no
        {
            next()
        }

    }, 
    function (session: builder.Session, args: any, next: any)
    {

        console.log("Building the user's account")
        // build the account
        
        // Check to see if favorite locations have been added 
        let FavoriteLocations = session.userData.favoriteLocations;

        // Determine if undefined
        if (!FavoriteLocations)
        {
            FavoriteLocations = {};
        }

        var VisitedLocations = 
        {
            [now]:
            {
            }
        };

        var Entity = 
        {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Favorite_Locations: entGen.String(JSON.stringify(FavoriteLocations)),
            Visited_Locations: entGen.String(JSON.stringify(VisitedLocations))
        };

        tableService.insertOrReplaceEntity("User", Entity, function (error, result, response)
        {
            if (!error) 
            {
                    console.log("Person added to Table");
                    session.userData.favoriteLocations = FavoriteLocations;
                    session.endDialog("Your account has been updated. And you have been signed in!");
            }
            else 
            {
                console.log("There was an error adding the person: \n\n");
                session.endDialog("There was an error updating your account");
                console.log(error);
            }   
        })
    }

])

bot.dialog('/addFavorites', [
    
    function (session: builder.Session, args, next: any)
    {
        builder.Prompts.text(session, "What is the name of your favorite location? E.g. 'Work', or 'Home'");
    },

    function (session: builder.Session, results: builder.IPromptTextResult, next: any)
    {
        session.dialogData.tempFavoriteLocationName = results.response;
        builder.Prompts.text(session, "What is the address for that location? E.g. '2200 Main Street Austin, Texas' or '15 and Broadway New York, New York'");
    },

    function (session: builder.Session, results: builder.IPromptTextResult, next: any)
    {
        // save the data
        session.dialogData.tempFavoriteLocationAddress = results.response;

        // send an image of the correct location and verify
        // get the geocode
        googleMapsClient.geocode({ address: results.response}, function (err, response)
        {
            // get the latitutde
            let lat = response.json.results[0].geometry.location.lat;
            session.dialogData.lat = response.json.results[0].geometry.location.lat;

            // get the longitude
            let long = response.json.results[0].geometry.location.lng;
            session.dialogData.long = response.json.results[0].geometry.location.lng;
            
            
            let mapMessage: builder.Message = map_builder.map_card_builder(session, lat, long)
            mapMessage.text("Is this the correct information?")
            session.send(mapMessage);
            

            builder.Prompts.choice(session, `You said your location name was '${session.dialogData.tempFavoriteLocationName}' and the address was '${results.response}.' Is that correct?`, ["Yes", "No"]);


        })
    },
    function(session: builder.Session, results: builder.IPromptChoiceResult, next: any)
    {
        if (results.response && results.response.index == 0) // yes, the information is correct
        {
            // add the information to the array of favorite locations
            let tempFavoriteLocationName: string = session.dialogData.tempFavoriteLocationName;
            let tempFavoriteLocationAddress: string = session.dialogData.tempFavoriteLocationAddress;
            
            // Check to see if the user already has favorites
            let FavoriteLocation = session.userData.favoriteLocations
            if (!FavoriteLocation) // there is no data
            {
                console.log("There are no favorite locations");
                let FavoriteLocation = {};
                FavoriteLocation[tempFavoriteLocationName] = 
                {
                    "address": tempFavoriteLocationAddress,
                    "lat": session.dialogData.lat,
                    "long": session.dialogData.long 
                }
                
                // Add the location to the favorite
                session.userData.favoriteLocations = FavoriteLocation;
            }
            else // if the data exists
            {
                console.log("Add a new favorite location");
                
                // Add the information about the location
                FavoriteLocation[tempFavoriteLocationName] = 
                {
                    "address": tempFavoriteLocationAddress,
                    "lat": session.dialogData.lat,
                    "long": session.dialogData.long 
                }
                session.userData.favoriteLocations = FavoriteLocation;
            }

            builder.Prompts.choice(session, "Would you like to add another favorite?", ["Yes", "No"]);

        }
        else if (results.response && results.response.index == 1) // no they are not correct
        {
            session.send("Okay we will start over");
            session.replaceDialog("/addFavorites");
        }
    },
    
    function (session: builder.Session, results: builder.IPromptChoiceResult, next: any)
    {
        if (results.response && results.response.index == 0) // want to add another location
        {
            session.replaceDialog('/addFavorites')
        }
        else if (results.response && results.response.index == 1) // do not want to add another 
        {
            session.endDialog("Okay, updating your account!");
        }
    }
])

bot.dialog('/removeFavorites', [
    (session: builder.Session, results: any, next: any) =>
    {
        // Add the favorites to the string array
        let favorites: string[] = ["Cancel"];
        console.log(session.userData.favoriteLocations);
        let favoriteLocations: any = session.userData.favoriteLocations
        for (let key in favoriteLocations)
        {
            favorites.push(key);
        }

        builder.Prompts.choice(session, "Which location would you like to remove from favorites?", favorites);
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        let favoriteLocations: any = session.userData.favoriteLocations
        for (let key in favoriteLocations)
        {
            if (results.response && key == results.response.entity)
            {
                delete favoriteLocations[key]
            }
        }

        // upload the new favorite locations to userData
        session.userData.favoriteLocations = favoriteLocations;
        session.endDialog();
    }
])

bot.dialog('/login', [
    (session: builder.Session, results: any, next: any) =>
    {
        builder.Prompts.text(session, "Welcome to the 'Login Dialog'. What is your Phone Number?");
    },
    (session: builder.Session, results: builder.IPromptTextResult, next: any) =>
    {
        if (results.response)
        {
            session.dialogData.phone = PhoneStrip(results.response)
        };

        builder.Prompts.text(session, "What is your pin?")

    },
    (session: builder.Session, results: builder.IPromptTextResult, next: any) =>
    {
        session.dialogData.pin = results.response;

        console.log("Getting the user from the table")
        let query = new azureStorage.TableQuery()
            .where('PartitionKey eq ?', session.dialogData.phone)
            .and("RowKey eq ?", session.dialogData.pin);
        tableService.queryEntities("User", query, null, function (error, result, response)
        {
            if (error)
            {   
                console.log("There was an error getting the user.")
                console.log(error)
                builder.Prompts.text(session, "There was an unknown error finding your account. Would you like to try again?", ["Yes", "No"]);
            }
            else
            {
                console.log("No Error!")

                // Check to see if the user was found
                if (result.entries.length == 0)
                {
                    builder.Prompts.choice(session, "We could not find your account. Would you like to try again?", ["Yes", "No"]);
                }
                else
                {
                    // Get all of the locations and restore the account
                    console.log(result.entries[0].Favorite_Locations._);

                    session.userData.favoriteLocations = JSON.parse(result.entries[0].Favorite_Locations._);
                    session.userData.phone = session.dialogData.phone;
                    session.userData.pin = session.dialogData.pin;
                    session.endDialog("We found your account! You are now logged in. ")
                }
            }
        })
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response && results.response.index == 0) // yes, try again
        {
            session.replaceDialog('/login');
        }
        else
        {
            session.endDialog("Okay I am returning you to the previous dialog.");
        }
    }

])

bot.dialog('/edit', [

    (session: builder.Session, args: any, next: any) =>
    {
        session.send("Welcome to the 'Account Edit Dialog!' We need to make sure you are logged in in first!")

        // check to see if there is user data
        // Go to the next step in the waterfall
        if (session.userData.phone && session.userData.pin)
        {
            next();
        }
        else
        {
            session.beginDialog("/login")
        }
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        builder.Prompts.choice(session,"Awesome, we have your info. What would you like to do next?", ["Remove Favorites", "Add Favorites", "Cancel"])
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response && results.response.index == 0) // remove favorites
        {
            session.beginDialog('/removeFavorites');
        }
        else if (results.response && results.response.index == 1) // add favorites
        {
            session.beginDialog('/addFavorites');
        }
        else // cancel
        {
            session.endDialog("Okay returning you to account settings home.")
        }
    }, 
    (session: builder.Session, result: builder.IDialogResult<any>, next: any) =>
    {
        // Create the entity 
        let newUser = 
        {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Favorite_Locations: entGen.String(JSON.stringify(session.userData.favoriteLocations))
        }
        // Update the database
        tableService.mergeEntity("User", newUser, (error,results, response) => 
        {
            if (error)
            {
                console.log(error);
                session.send("There was an error when updating your acocunt.")
                session.replaceDialog('/edit');
            }
            else
            {
                console.log(results);
                session.send("Your account was successfully updated!");
                session.replaceDialog("/edit")
            }
        })
    }

])

bot.dialog('/commands', [
    (session: builder.Session) =>
    {
        session.send("At anytime you can say the following commands: 'cancel', 'restart', 'help'. 'Cancel' stops bot," +
        "'Restart' restarts the current step, and 'Help' launches the help guide");

        session.endDialog("Returning you to the main help dialog!");
    }
])

bot.dialog("/end", [
    (session: builder.Session) =>
    {
        session.endConversation("Thank you for using Travelr! Have a great day!");
    }
])

if (useEmulator) {
    let server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url); 
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}