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
//import * as botbuilder_azure from "botbuilder-azure";

let googleMapsClient: any = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4' //process.env.GOOGLE_MAPS_KEY
});

let useEmulator: boolean = (process.env.NODE_ENV == 'development');

useEmulator = true;


/*
let connector: any = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

*/

let connector: builder.ChatConnector = new builder.ChatConnector();

let bot: builder.UniversalBot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));


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


//=========================================================
// Bots Dialogs
//=========================================================
bot.dialog('/', [

    // send the intro
    function (session: builder.Session, args: any, next: any): void
    {
        session.send("Hello and welcome to Travelr! We just need a few details to get you to your destination! You can say cancel or restart to redo your current step.");
        session.replaceDialog("/preferences");
    }
])

bot.dialog('/preferences', [
    function (session: builder.Session)
    {
        builder.Prompts.choice(session, "What is your preference on transportation", ["Value", "Time", "luxury"]);
    },
    // Save the perference 
    function (session: builder.Session, result: builder.IPromptChoiceResult, next: any)
    {
        switch (result.response.index) 
        {
            case 0:
                session.userData.perference = 0;
                break;
            case 1:
                session.userData.perference = 1;
                break;
            case 2:
                session.userData.perference = 2;
            default:
                session.userData.perference = 0;
                break;
        }

        next();
    },
    // Ask about seating preferences
    function (session: builder.Session): void
    {
        builder.Prompts.choice(session, "Do you have more than 4 people?",
        "Yes|No");
    },
    function (session: builder.Session, result: builder.IPromptChoiceResult,
    next: Function): void
    {
        switch (result.response.index) {
            case 0:
                session.userData.group = true;
                break;
            case 1: 
                session.userData.group = false;
                break;
            default:
                session.userData.group = true;
                break;
        }

        // Go to the next step
        session.replaceDialog('/locations');
    }

    
]).reloadAction("reloadPreferences", "Restarting Preference Gathering", {
    matches: [/^restart/i, /^start over/i]
})

bot.dialog("/locations", [

    // get the user's starting location
    function(session: builder.Session): void
    {
        builder.Prompts.text(session, "What is your starting location?");
    },

//=========================================================
// Google Geolocation
//=========================================================

    // save the result 
    function (session: builder.Session, result:builder.IPromptTextResult, next: any): void
    {
        session.userData.start = result.response;

        // call the google maps function to get the coordinates 
        googleMapsClient.geocode(
            {
                address: result.response
            },
            function (err, response): void
            {
                if (!err)
                {   
                    // Get and save the latitude
                    session.userData.start_lat = response.json.results[0].geometry.location.lat

                    // get the longitude
                    session.userData.start_long = response.json.results[0].geometry.location.lng

                    
                    // Proceed to the next dialogue 
                    next();
                }
                
                // if there is an error 
                else 
                {
                    // Call the error dialogue
                    console.log("There was an error getting your starting location");
                }
            }
        )
    },
    
    // Get the users's destination lcoation
    function(session: builder.Session)
    {
        console.log("Asking for destination");
        builder.Prompts.text(session, "What is your destination?");
    },

    // Save the results 
    function(session: builder.Session, results: builder.IPromptTextResult, next: Function): void
    {
        console.log("Have the users desstination");
        session.userData.end = results.response;

        // Call the google maps clinent
        googleMapsClient.geocode(
            {
                address: results.response
            },

            function(err, response): void
            {
                if (!err)
                {
                    // get the latitutde
                    session.userData.end_lat = response.json.results[0].
                    geometry.location.lat;

                    // get the longitude
                    session.userData.end_long = response.json.results[0].geometry.location.lng

                    
                    session.beginDialog("/calculation");

                }

                // If there is an error
                else
                {
                    // call the error dialogue
                    // Unable to determine location
                    console.log("There was an error in getting destination");
                }
            }
        )
    }
]).reloadAction("reloadLocations", "Getting your location again", {
    matches: [/^restart/i, /^start over/i]
})

bot.dialog('/calculation',[
//=========================================================
// Map information 
//=========================================================

    // Begin processing the information
    function (session: builder.Session, args: any, next: any): void
    {
        session.send("Hold on while we get your results");

        // pull down the lats and long
        let start_lat: number = session.userData.start_lat;
        let end_lat: number = session.userData.end_lat;
        let start_long: number = session.userData.start_long;
        let end_long: number = session.userData.end_long;

        let MainUrl: string = "https://maps.googleapis.com/maps/api/staticmap?";

        let Key: string = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";

        // Set the constants
        let Size: string = "&size=640x640";

        let Format: string = "&format=gif";

        let MarkerStyleStart: string = "&markers=color:red|label:A|" + start_lat + "," + start_long;  

        let MarkerStyleEnd: string = "&markers=color:red|label:B|" + end_lat + "," + end_long; 

        let Path: string = "&path=color:blue|" + session.userData.start_lat + "," + session.userData.start_long + "|" + session.userData.end_lat + "," + session.userData.end_long;

        let Query: string = MainUrl + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key; 

        session.send("Here is a map of your locations");

        // Build the new message 
        var msg = new builder.Message(session)
        .attachments([{
            contentType: "image/gif",
            contentUrl: Query
        }]);

        // Send the message
        session.send(msg);

        // Go to the next step
        next();

    },

//=========================================================
// Get all of the information
//=========================================================

    // Get transit
    function(session: builder.Session, ars: any, next: Function)
    {
        // Log step to console
        console.log("Getting Google Transit informaiton")

        // Set the constants 
        // pull down the lats and long
        const start_lat: string = session.userData.start_lat;
        const end_lat: string = session.userData.end_lat;
        const start_long: string = session.userData.start_long;
        const end_long: string = session.userData.end_long; 

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
                    session.userData.Transit = errorTransit;
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

                        session.userData.Transit = errorTransit;
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
                                session.userData.Transit = transitLegInfo;
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
        const perference: number = session.userData.perference; 
        const group: boolean = session.userData.group;
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
                session.userData.Uber = best_uber_option;
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
                            rides.push({display_name: ride.display_name});
                        }
                    }

                    if (group)
                    {
                        if (ride.capacity > 4)
                        {
                            rides.push({display_name: ride.display_name});
                            continue;
                        }
                    }

                    if (!group)
                    {
                        if (ride.capacity < 5)
                        {
                            rides.push({display_name: ride.display_name});
                            continue;
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
                    let body: Uber.IUberPrices = JSON.parse(info);
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
                        session.userData.Uber = best_uber_option;
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
                                session.userData.Uber = best_uber_option;
                            }
                            else
                            {
                                console.log("Have driver times");

                                best_uber_option.uber_driver_time = body.times[0].estimate;

                                // Set the User data
                                session.userData.Uber = best_uber_option;
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
                    session.userData.Lyft = best_lyft_option;
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
                        if (ride.display_name != "Lyft Line") 
                        {
                            lyftRideTypes.push({
                                ride_type: ride.ride_type,
                                display_name: ride.display_name
                            });
                        }
                    }

                    if (group)
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

                    if (!group)
                    {
                        if (ride.seats < 5)
                        {
                            lyftRideTypes.push({
                                ride_type: ride.ride_type,
                                display_name: ride.display_name
                            });
                            continue;
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
                        session.userData.Lyft = best_lyft_option;
                    }

                    else
                    {   
                        console.log("Have lyft prices");

                        let body: Lyft.IAllEstimates = JSON.parse(info);

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
                                session.userData.Lyft = best_lyft_option;

                            }
                            
                            else
                            {
                                // Parse the JSON
                                let body: Lyft.AllEtas = JSON.parse(info);

                                // Set the Driver time
                                best_lyft_option.driver_time = body.eta_estimates[0].eta_seconds;

                                // Save the info to user data
                                session.userData.Lyft = best_lyft_option;
                                
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
        let preference: number = session.userData.perference;

        // Grab the infomation
        let uber: Uber.IBestOption = session.userData.Uber;
        let lyft: Lyft.IBestLyftOption = session.userData.Lyft;
        let transitInfo: Transit.IFinalLegInfo = session.userData.Transit;
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
        
        // Add the options to the userdata
        session.userData.Rideshare = rideshare;

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
        let transit: Transit.IFinalLegInfo = session.userData.Transit;
        let rideshare: Results.IRideshare = session.userData.Rideshare;
        let startLat: string = session.userData.start_lat;
        let startLong: string = session.userData.start_long;
        let endLat: string = session.userData.end_lat; 
        let endLong: string = session.userData.end_long;

        // User wants to see transit information
        if (response.response.index == 0)
        {
            if (transit.transitArrivalTime == "Error")
            {
                session.send("There was an error when looking for transit in your locations.")
            }
            else
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
        }

        // User want ridesharing information
        else if (response.response.index == 1)
        {
            // Check the rideshare service provider
            if (rideshare.serviceProvider == "Uber")
            {
                let uberClientId: string = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP' //process.env.UBER_APP_ID

                // Format the addresses
                let pickup: string = LocationAddressFomater(session.userData.start);
                let dropoff: string = LocationAddressFomater(session.userData.end);


                let uberString: string = `https://m.uber.com/ul/?action=setPickup&client_id=${uberClientId}&product_id=${rideshare.proudctId}&pickup[formatted_address]=${pickup}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&dropoff[formatted_address]=${dropoff}&dropoff[latitude]=${endLat}&dropoff[longitude]=${endLong}`;
                
                let uberCard: builder.Message = new builder.Message(session)
                    .addAttachment({
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
                    })
                    .addAttachment(
                        new builder.ThumbnailCard(session)
                            .title("Order an Uber")
                            .text("Click to order your Uber in the Uber App!")
                            .images([builder.CardImage.create(session, 'https://d1a3f4spazzrp4.cloudfront.net/uber-com/1.2.29/d1a3f4spazzrp4.cloudfront.net/images/apple-touch-icon-144x144-279d763222.png')])
                            .buttons([builder.CardAction.openUrl(session, uberString, "Order an Uber")])
                            )

                session.send(uberCard);
        }   

            else if (rideshare.serviceProvider == 'Lyft')
            {
                let clientId: string = '9LHHn1wknlgs';


                // Order the Lyft
                let lyftString: string = `https://lyft.com/ride?id=${rideshare.proudctId}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&partner=${clientId}&destination[latitude]=${endLat}&destination[longitude]=${endLong}`;

                let lyftCard: builder.Message = new builder.Message(session)
                    .addAttachment({
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
                    })
                .addAttachment(new builder.ThumbnailCard(session)
                    .title("Order your Lyft!")
                    .text("Click the button to order your Lyft in the Lyft App!")
                    .images([builder.CardImage.create(session, "https://www.lyft.com/apple-touch-icon-precomposed-152x152.png")])
                    .buttons([builder.CardAction.openUrl(session, lyftString, "Order Lyft")]))

                session.send(lyftCard)
            }

            else
            {
                session.send("We could not find any ridesharing options here");
            }

            // repeat the dialog
            session.replaceDialog('/options');
        }
        // User is done with the conversation
        else
        {
            session.endConversation("Thank you for using Travelr! Have a great day!");
        }     
    }
]);

bot.dialog("/Info", [
    function(session: builder.Session): void
    {
        builder.Prompts.choice(session, "What information would you like to see",
        "Company Info|Privacy|How It Works");
    },

    function(session:builder.Session, response:builder.IPromptChoiceResult, next)
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

        session.replaceDialog("/")
    },


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