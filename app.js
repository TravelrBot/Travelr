"use strict";
exports.__esModule = true;
var builder = require("botbuilder");
var restify = require("restify");
var request = require("request");
var googleMaps = require("@google/maps");
var process = require("process");
var path = require("path");
//import * as botbuilder_azure from "botbuilder-azure";
var googleMapsClient = googleMaps.createClient({
    key: process.env.GOOGLE_MAPS_KEY
});
var useEmulator = (process.env.NODE_ENV == 'development');
useEmulator = true;
/*
let connector: any = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

*/
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));
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
//=========================================================
// Bots Dialogs
//=========================================================
bot.dialog('/', [
    // send the intro
    function (session, args, next) {
        session.send("Hello and welcome to Travelr! We just need a few details to get you to your destination!");
        next();
    },
    // Get the user's preference
    function (session) {
        builder.Prompts.choice(session, "What is your preference on transportation?", "Value|Time|Luxury");
    },
    // Save the perference 
    function (session, result, next) {
        switch (result.response.index) {
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
    function (session) {
        builder.Prompts.choice(session, "Do you have more than 4 people?", "Yes|No");
    },
    function (session, result, next) {
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
        next();
    },
    // get the user's starting location
    function (session) {
        builder.Prompts.text(session, "What is your starting location?");
    },
    //=========================================================
    // Google Geolocation
    //=========================================================
    // save the result 
    function (session, result, next) {
        session.userData.start = result.response;
        // call the google maps function to get the coordinates 
        googleMapsClient.geocode({
            address: result.response
        }, function (err, response) {
            if (!err) {
                // Get and save the latitude
                session.userData.start_lat = response.json.results[0].geometry.location.lat;
                // get the longitude
                session.userData.start_long = response.json.results[0].geometry.location.lng;
                // Proceed to the next dialogue 
                next();
            }
            else {
                // Call the error dialogue
            }
        });
    },
    // Get the users's destination lcoation
    function (session) {
        console.log("Asking for destination");
        builder.Prompts.text(session, "What is your destination?");
    },
    // Save the results 
    function (session, results, next) {
        console.log("Have the users desstination");
        session.userData.end = results.response;
        // Call the google maps clinent
        googleMapsClient.geocode({
            address: results.response
        }, function (err, response) {
            if (!err) {
                // get the latitutde
                session.userData.end_lat = response.json.results[0].
                    geometry.location.lat;
                // get the longitude
                session.userData.end_long = response.json.results[0].geometry.location.lng;
                next();
            }
            else {
                // call the error dialogue
                // Unable to determine location
                console.log();
            }
        });
    },
    //=========================================================
    // Map information 
    //=========================================================
    // Begin processing the information
    function (session, args, next) {
        session.send("Hold on while we get your results");
        // pull down the lats and long
        var start_lat = session.userData.start_lat;
        var end_lat = session.userData.end_lat;
        var start_long = session.userData.start_long;
        var end_long = session.userData.end_long;
        var MainUrl = "https://maps.googleapis.com/maps/api/staticmap?";
        var Key = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";
        // Set the constants
        var Size = "&size=640x640";
        var Format = "&format=gif";
        var MarkerStyleStart = "&markers=color:red|label:A|" + start_lat + "," + start_long;
        var MarkerStyleEnd = "&markers=color:red|label:B|" + end_lat + "," + end_long;
        var Path = "&path=color:blue|" + session.userData.start_lat + "," + session.userData.start_long + "|" + session.userData.end_lat + "," + session.userData.end_long;
        var Query = MainUrl + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key;
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
    function (session, ars, next) {
        // Log step to console
        console.log("Getting Google Transit informaiton");
        // Set the constants 
        // pull down the lats and long
        var start_lat = session.userData.start_lat;
        var end_lat = session.userData.end_lat;
        var start_long = session.userData.start_long;
        var end_long = session.userData.end_long;
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
                session.userData.Transit = errorTransit;
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
                    session.userData.Transit = errorTransit;
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
                                        transitSteps: []
                                    };
                            }
                            else {
                                transitLegInfo =
                                    {
                                        transitArrivalTime: leg.arrival_time.text,
                                        transitDepartureTime: leg.departure_time.text,
                                        transitDistance: leg.distance.text,
                                        transitDuration: leg.duration.text,
                                        transitSteps: []
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
        var client_id = process.env.UBER_APP_ID,
        var client_secret = process.env.UBER_APP_PASSWORD,
        var server_token = process.env.UBER_APP_TOKEN,
        var perference = session.userData.perference;
        var group = session.userData.group;
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
                session.userData.Uber = best_uber_option;
            }
            else {
                var body = JSON.parse(info);
                console.log("Got Uber Product info");
                for (var index = 0; index < body.products.length; index++) {
                    var ride = body.products[index];
                    if (perference == 2) {
                        if (ride.display_name == "SELECT" || ride.display_name == "BLACK" || ride.display_name == "SUV") {
                            rides.push({ display_name: ride.display_name });
                        }
                    }
                    if (group) {
                        if (ride.capacity > 4) {
                            rides.push({ display_name: ride.display_name });
                            continue;
                        }
                    }
                    if (!group) {
                        if (ride.capacity < 5) {
                            rides.push({ display_name: ride.display_name });
                            continue;
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
                    var body = JSON.parse(info);
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
                        session.userData.Uber = best_uber_option_1;
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
                                session.userData.Uber = best_uber_option_2;
                            }
                            else {
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
                session.userData.Lyft = best_lyft_option;
            }
            else {
                console.log("In lyft Ride Types");
                var body = JSON.parse(info);
                for (var index = 0; index < body.ride_types.length; index++) {
                    var ride = body.ride_types[index];
                    if (perference == 2) {
                        if (ride.display_name != "Lyft Line") {
                            lyftRideTypes.push({
                                ride_type: ride.ride_type,
                                display_name: ride.display_name
                            });
                        }
                    }
                    if (group) {
                        if (ride.seats > 4) {
                            lyftRideTypes.push({
                                ride_type: ride.ride_type,
                                display_name: ride.display_name
                            });
                            continue;
                        }
                    }
                    if (!group) {
                        if (ride.seats < 5) {
                            lyftRideTypes.push({
                                ride_type: ride.ride_type,
                                display_name: ride.display_name
                            });
                            continue;
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
                        session.userData.Lyft = best_lyft_option;
                    }
                    else {
                        console.log("Have lyft prices");
                        var body_1 = JSON.parse(info);
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
                                session.userData.Lyft = best_lyft_option_2;
                            }
                            else {
                                // Parse the JSON
                                var body_2 = JSON.parse(info);
                                // Set the Driver time
                                best_lyft_option_1.driver_time = body_2.eta_estimates[0].eta_seconds;
                                // Save the info to user data
                                session.userData.Lyft = best_lyft_option_1;
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
        var preference = session.userData.perference;
        // Grab the infomation
        var uber = session.userData.Uber;
        var lyft = session.userData.Lyft;
        var transitInfo = session.userData.Transit;
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
        // Build the transit string 
        var transitString;
        if (transitInfo.transitDistance == "Error") {
            transitString = 'We could not find transit in this area <br/> <br/>';
        }
        else {
            // Build out the strings
            transitString = "Transit <br/>\n            - Departure Time: " + transitInfo.transitDepartureTime + " <br/>\n            - Arrival Time: " + transitInfo.transitArrivalTime + " <br/>\n            - Distance: " + transitInfo.transitDistance + " miles <br/>\n            - Duration " + transitInfo.transitDuration + " minutes <br/>";
        }
        // Check to see if there is an error with the ridesharing 
        var rideshareString;
        if (rideshare.serviceType == "Error") {
            rideshareString = "We could not find any rideharing options";
        }
        else {
            rideshareString = "Rideshare <br/>\n            - Service: " + rideshare.serviceProvider + " <br/>\n            - Ride Type: " + rideshare.serviceType + " <br/>\n            - Price: " + rideshare.price + " <br/>\n            - Driver Distance: " + rideshare.driverTime + " minutes away <br/>\n            - Total Distance: " + rideshare.totalDistance + " miles <br/>\n            - Total Duration: " + rideshare.totalTime + " minutes <br/>";
        }
        session.send(transitString + rideshareString);
        // Add the options to the userdata
        session.userData.Rideshare = rideshare;
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
        var transit = session.userData.Transit;
        var rideshare = session.userData.Rideshare;
        var startLat = session.userData.start_lat;
        var startLong = session.userData.start_long;
        var endLat = session.userData.end_lat;
        var endLong = session.userData.end_long;
        // User wants to see transit information
        if (response.response.index == 0) {
            if (transit.transitArrivalTime == "Error") {
                session.send("There was an error when looking for transit in your locations.");
            }
            else {
                // Array to Hold all direction string 
                var directions = "";
                for (var step = 0; step < transit.transitSteps.length; step++) {
                    // Check to see if walking or transit step
                    if (transit.transitSteps[step].stepTransitMode == "WALKING") {
                        var walkingStep = transit.transitSteps[step];
                        directions += walkingStep.stepMainInstruction + " <br/> \n            - Distance: " + walkingStep.stepDistance + " <br/>\n            - Duration: " + walkingStep.stepDuration + " <br/>\n            ";
                        for (var step_1 = 0; step_1 < walkingStep.stepDeatiledInstructions.length; step_1++) {
                            if (step_1 == walkingStep.stepDeatiledInstructions.length - 1) {
                                directions += "- Step " + (step_1 + 1) + ": " + walkingStep.stepDeatiledInstructions[step_1].stepMainInstruction + " <br/>";
                            }
                            else {
                                directions += "- Step " + (step_1 + 1) + ": " + walkingStep.stepDeatiledInstructions[step_1].stepMainInstruction + " <br/> \n            ";
                            }
                        }
                    }
                    else {
                        var transitStep = transit.transitSteps[step];
                        directions += transitStep.stepMainInstruction + " <br/>\n            - Depature Name: " + transitStep.departureStopName + " <br/>\n            - Deapture Time: " + transitStep.departureStopTime + " <br/>\n            - Arrival Name: " + transitStep.arrivalStopName + " <br/>\n            - Arrival Time: " + transitStep.arrivalStopTime + " <br/>\n            - Distance: " + transitStep.stepDistance + " miles <br/>\n                        - Duration: " + transitStep.stepDuration + " minutes <br/>\n                        - Number of Stops: " + transitStep.numberOfStop + " <br/>\n                        - Vehicle Name: " + transitStep.vehicleName + " <br/>\n                        - Vehicle Type: " + transitStep.vehicleType + " <br/>";
                    }
                }
                session.send(directions);
                // repeat the dialog
                session.replaceDialog('/options');
            }
        }
        else if (response.response.index == 1) {
            // Check the rideshare service provider
            if (rideshare.serviceProvider == "Uber") {
                var uberClientId = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP'; //process.env.UBER_APP_ID
                // Format the addresses
                var pickup = LocationAddressFomater(session.userData.start);
                var dropoff = LocationAddressFomater(session.userData.end);
                // Order the Uber
                session.send("Click the link to open the app and order your ride!");
                var uberString = "'https://m.uber.com/ul/?action=setPickup&client_id=" + uberClientId + "&product_id=" + rideshare.proudctId + "&pickup[formatted_address]=" + pickup + "&pickup[latitude]=" + startLat + "&pickup[longitude]=" + startLong + "&dropoff[formatted_address]=" + dropoff + "&dropoff[latitude]=" + endLat + "&dropoff[longitude]=" + endLong;
                session.send(uberString);
            }
            else if (rideshare.serviceProvider == 'Lyft') {
                var clientId = '9LHHn1wknlgs';
                // Order the Lyft
                session.send("Or click the link to open the app and order your ride!");
                var lyftString = "https://lyft.com/ride?id=" + rideshare.proudctId + "&pickup[latitude]=" + startLat + "&pickup[longitude]=" + startLong + "&partner=" + clientId + "&destination[latitude]=" + endLat + "&destination[longitude]=" + endLong;
                session.send(lyftString);
            }
            else {
                session.send("We could not find any ridesharing options here");
            }
            // repeat the dialog
            session.replaceDialog('/options');
        }
        else {
            session.endConversation("Thank you for using Travelr! Have a great day!");
        }
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
    module.exports = { "default": connector.listen() };
}
