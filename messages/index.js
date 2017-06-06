"use strict";
exports.__esModule = true;
const builder = require("botbuilder");
const restify = require("restify");
const request = require("request");
const googleMaps = require("@google/maps");
const process = require("process");
const path = require("path");
const botbuilder_azure = require("botbuilder-azure");

var googleMapsClient = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4' //process.env.GOOGLE_MAPS_KEY
});
var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
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
// Trigger Dialogs
//=========================================================
bot.dialog("/cancel", [
    function (session) {
        session.endConversation("Thank you for using Travelr!");
    }
]).triggerAction({
    confirmPrompt: "Are you sure you want to cancel?",
    matches: /^cancel/i
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
        if (results.response.index == 0) {
            session.beginDialog('/info');
        }
        else if (results.response.index == 1) {
            session.beginDialog('/commands');
        }
        else {
            session.endDialog("Leaving the help dialog and returning you to your step!");
            console.log("Ater end dialog \n\n\n\n\n");
        }
        next();
    },
    function (session) {
        session.replaceDialog('/help');
    }
]).triggerAction({
    matches: /^help$/,
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
//=========================================================
// Bots Dialogs
//=========================================================
bot.dialog('/', [
    function (session, args, next) {
        session.send("Hello and welcome to Travelr! We just need a few details to get you to your destination! You can say cancel or restart to redo your current step.");
        session.replaceDialog("/preferences");
    }
]);
bot.dialog('/preferences', [
    function (session, args, next) {
        console.log("Getting user preference");
        builder.Prompts.choice(session, "What is your preference on transportation", ["Value", "Time", "luxury"]);
    },
    function (session, result, next) {
        console.log("Determining result");
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
        session.replaceDialog('/locations');
    }
]).reloadAction("reloadPreferences", "Restarting Preference Gathering", {
    matches: [/^restart/i, /^start over/i]
});
bot.dialog("/locations", [
    function (session) {
        builder.Prompts.text(session, "What is your starting location?");
    },
    function (session, result, next) {
        session.userData.start = result.response;
        googleMapsClient.geocode({
            address: result.response
        }, function (err, response) {
            if (!err) {
                session.userData.start_lat = response.json.results[0].geometry.location.lat;
                session.userData.start_long = response.json.results[0].geometry.location.lng;
                next();
            }
            else {
                console.log("There was an error getting your starting location");
            }
        });
    },
    function (session) {
        console.log("Asking for destination");
        builder.Prompts.text(session, "What is your destination?");
    },
    function (session, results, next) {
        console.log("Have the users desstination");
        session.userData.end = results.response;
        googleMapsClient.geocode({
            address: results.response
        }, function (err, response) {
            if (!err) {
                session.userData.end_lat = response.json.results[0].
                    geometry.location.lat;
                session.userData.end_long = response.json.results[0].geometry.location.lng;
                session.beginDialog("/calculation");
            }
            else {
                console.log("There was an error in getting destination");
            }
        });
    }
]).reloadAction("reloadLocations", "Getting your location again", {
    matches: [/^restart/i, /^start over/i]
});
bot.dialog('/calculation', [
    function (session, args, next) {
        session.send("Hold on while we get your results");
        let start_lat = session.userData.start_lat;
        let end_lat = session.userData.end_lat;
        let start_long = session.userData.start_long;
        let end_long = session.userData.end_long;
        let MainUrl = "https://maps.googleapis.com/maps/api/staticmap?";
        let Key = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";
        let Size = "&size=640x640";
        let Format = "&format=gif";
        let MarkerStyleStart = "&markers=color:red|label:A|" + start_lat + "," + start_long;
        let MarkerStyleEnd = "&markers=color:red|label:B|" + end_lat + "," + end_long;
        let Path = "&path=color:blue|" + session.userData.start_lat + "," + session.userData.start_long + "|" + session.userData.end_lat + "," + session.userData.end_long;
        let Query = MainUrl + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key;
        session.send("Here is a map of your locations");
        var msg = new builder.Message(session)
            .attachments([{
                contentType: "image/gif",
                contentUrl: Query
            }]);
        session.send(msg);
        next();
    },
    function (session, ars, next) {
        console.log("Getting Google Transit informaiton");
        const start_lat = session.userData.start_lat;
        const end_lat = session.userData.end_lat;
        const start_long = session.userData.start_long;
        const end_long = session.userData.end_long;
        let transitFlag = false;
        let uberFlag = false;
        let lyftFlag = false;
        let transitUrl = 'https://maps.googleapis.com/maps/api/directions/json?';
        let transitOrigin = '&origin=' + start_lat + ',' + start_long;
        let transitDestination = '&destination=' + end_lat + ',' + end_long;
        let transitMode = '&mode=transit';
        let transitLanguage = "&language=en";
        let transitUnits = '&units=imperial';
        let transitKey = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";
        let transitQuery = transitUrl + transitOrigin + transitDestination + transitMode + transitLanguage + transitUnits +
            transitKey;
        let transitHeaders = {
            'Content-Type': 'application/json',
            'Accept-Language': 'en_EN'
        };
        let transitOptions = {
            url: transitQuery,
            headers: transitHeaders
        };
        request(transitOptions, function (error, response, info) {
            if (error) {
                console.log(error);
                console.log("There was an error in google transit information");
                session.send("There was an unknown error getting transit info");
                let errorTransit = {
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
                let body = JSON.parse(info);
                if (body.status != "OK") {
                    console.log("No transit in area");
                    session.send("Transit is not available in this area.");
                    let errorTransit = {
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
                    for (let route_step = 0; route_step < body.routes.length; route_step++) {
                        let legs = body.routes[route_step].legs;
                        legs.forEach(leg => {
                            let transitLegInfo;
                            if (leg.steps.length == 1) {
                                let currentTime = Date.now();
                                let departureTime = currentTime;
                                let arrivalTime = currentTime + (leg.duration.value * 10);
                                let departureDate = new Date(departureTime);
                                let arrivalDate = new Date(arrivalTime);
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
                            let steps = leg.steps;
                            steps.forEach(step => {
                                if (step.travel_mode == "WALKING") {
                                    let walkingStepInfo = {
                                        stepDistance: step.distance.text,
                                        stepDuration: step.duration.text,
                                        stepMainInstruction: step.html_instructions,
                                        stepTransitMode: step.travel_mode,
                                        stepDeatiledInstructions: []
                                    };
                                    step.steps.forEach(detailedStep => {
                                        let detailedStepInfo = {
                                            stepDistance: detailedStep.distance.text,
                                            stepDuration: detailedStep.duration.text,
                                            stepMainInstruction: HtmlParse(detailedStep.html_instructions),
                                            stepTransitMode: detailedStep.travel_mode
                                        };
                                        walkingStepInfo.stepDeatiledInstructions.push(detailedStepInfo);
                                    });
                                    transitLegInfo.transitSteps.push(walkingStepInfo);
                                }
                                else {
                                    let transitStepInfo = {
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
                                    transitLegInfo.transitSteps.push(transitStepInfo);
                                }
                            });
                            session.userData.Transit = transitLegInfo;
                            transitFlag = true;
                        });
                    }
                }
            }
        });
        console.log("In uber");
        const client_id = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP';
        const client_secret = 'vAy-juG54SV15yiv7hsDgVMegvMDPbjbtuayZ48a';
        let server_token = 'CSQlbbbn6k0gbYZULEqiLk0cwUy03ZIPkIYxPrOs';
        const perference = session.userData.perference;
        const group = session.userData.group;
        let rides = [];
        let headers = {
            'Authorization': 'Token ' + server_token,
            'Content-Type': 'application/json',
            'Accept-Language': 'en_EN'
        };
        let options = {
            url: 'https://api.uber.com/v1.2/products?latitude=' + start_lat + '&longitude=' + start_long,
            headers: headers
        };
        request(options, function (error, response, info) {
            if (error || response.statusCode == 400) {
                console.log("Error when getting uber info");
                console.log(error);
                console.log(response.statusCode);
                let best_uber_option = {
                    uber_distance: Number.MAX_SAFE_INTEGER,
                    uber_driver_time: Number.MAX_SAFE_INTEGER,
                    uber_name: "Error",
                    uber_price: Number.MAX_SAFE_INTEGER,
                    uber_productId: "Error",
                    uber_travel_time: Number.MAX_SAFE_INTEGER
                };
                uberFlag = true;
                session.userData.Uber = best_uber_option;
            }
            else {
                let body = JSON.parse(info);
                console.log("Got Uber Product info");
                for (let index = 0; index < body.products.length; index++) {
                    let ride = body.products[index];
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
                headers = {
                    'Authorization': 'Token ' + server_token,
                    'Content-Type': 'application/json',
                    'Accept-Language': 'en_EN'
                };
                options = {
                    url: 'https://api.uber.com/v1.2/estimates/price?start_latitude=' + start_lat + '&start_longitude=' + start_long + '&end_latitude=' + end_lat + '&end_longitude=' + end_long,
                    method: 'GET',
                    headers: headers
                };
                request(options, function (error, response, info) {
                    let body = JSON.parse(info);
                    let product = [];
                    let uber_price = 99999;
                    let best_uber_option = {
                        uber_distance: 0,
                        uber_driver_time: 0,
                        uber_name: "",
                        uber_price: 0,
                        uber_productId: "",
                        uber_travel_time: 0
                    };
                    if (error || response.statusCode == 400) {
                        console.log(error);
                        console.log(response.statusCode);
                        console.log("Not able to find pricing info");
                        let best_uber_option = {
                            uber_distance: Number.MAX_SAFE_INTEGER,
                            uber_driver_time: Number.MAX_SAFE_INTEGER,
                            uber_name: "Error",
                            uber_price: Number.MAX_SAFE_INTEGER,
                            uber_productId: "Error",
                            uber_travel_time: Number.MAX_SAFE_INTEGER
                        };
                        uberFlag = true;
                        session.userData.Uber = best_uber_option;
                    }
                    else {
                        console.log("Have Uber prices");
                        for (let index = 0; index < body.prices.length; index++) {
                            let ride = body.prices[index];
                            for (let e = 0; e < rides.length; e++) {
                                if (ride.display_name == rides[e].display_name) {
                                    product.push(ride);
                                }
                            }
                        }
                        for (let index = 0; index < product.length; index++) {
                            let ride = product[index];
                            if (index == 0) {
                                uber_price = ride.high_estimate;
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
                        headers = {
                            'Authorization': 'Token ' + server_token,
                            'Content-Type': 'application/json',
                            'Accept-Language': 'en_EN'
                        };
                        options = {
                            url: 'https://api.uber.com/v1.2/estimates/time?start_latitude=' + start_lat + '&start_longitude=' + start_long + '&product_id=' + best_uber_option.uber_productId,
                            method: 'GET',
                            headers: headers
                        };
                        request(options, function (error, response, info) {
                            let body = JSON.parse(info);
                            if (error || response.statusCode != 200 || body.times.length == 0) {
                                console.log(error);
                                console.log(response.statusCode);
                                console.log(info);
                                console.log("Unable to find drivers");
                                let best_uber_option = {
                                    uber_distance: Number.MAX_SAFE_INTEGER,
                                    uber_driver_time: Number.MAX_SAFE_INTEGER,
                                    uber_name: "Error",
                                    uber_price: Number.MAX_SAFE_INTEGER,
                                    uber_productId: "Error",
                                    uber_travel_time: Number.MAX_SAFE_INTEGER
                                };
                                uberFlag = true;
                                session.userData.Uber = best_uber_option;
                            }
                            else {
                                console.log("Have driver times");
                                best_uber_option.uber_driver_time = body.times[0].estimate;
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
        console.log("In Lyft");
        let lyftClientId = 'gAAAAABZIPjkPxmPgs83bWslOmxyt26-4AFcNDYZOwXWj4gyu7NEjddtxNK0DeNOqRrIsOCjKF-16_NiqApbMT-5vtGXJaulRmRk6b6QqDpYyU0MGYojno-FKnn58KzWRPwfoqFF8MUA5LTP0FpoNScafNXOeSgdic1eWsoGQm6Kg5c7TyQviRQ=';
        let lyftHeaders = {
            'Authorization': 'bearer ' + lyftClientId
        };
        let lyftOptions = {
            url: 'https://api.lyft.com/v1/ridetypes?lat=' + start_lat + '&lng=' + start_long,
            headers: lyftHeaders
        };
        let lyftRideTypes = [];
        let lyftRides = [];
        request(lyftOptions, function (error, response, info) {
            if (error || response.statusCode != 200) {
                console.log(error);
                console.log(response.statusCode);
                console.log("Cannot find products");
                let best_lyft_option = {
                    display_name: "Error",
                    driver_time: Number.MAX_SAFE_INTEGER,
                    estimated_distance_miles: Number.MAX_SAFE_INTEGER,
                    estimated_duration_seconds: Number.MAX_SAFE_INTEGER,
                    price: Number.MAX_SAFE_INTEGER,
                    primetime_percentage: "Error",
                    ride_type: "Error"
                };
                lyftFlag = true;
                session.userData.Lyft = best_lyft_option;
            }
            else {
                console.log("In lyft Ride Types");
                let body = JSON.parse(info);
                for (let index = 0; index < body.ride_types.length; index++) {
                    let ride = body.ride_types[index];
                    if (perference == 2) {
                        if (ride.display_name == "Lyft Premier" || ride.display_name == "Lyft Lux" || ride.display_name == "Lyft Lux SUV") {
                            if (group) {
                                if (ride.seats > 4) {
                                    lyftRideTypes.push({
                                        ride_type: ride.ride_type,
                                        display_name: ride.display_name
                                    });
                                    continue;
                                }
                            }
                            else {
                                if (ride.seats < 5) {
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
                        if (group) {
                            if (ride.seats > 4) {
                                lyftRideTypes.push({
                                    ride_type: ride.ride_type,
                                    display_name: ride.display_name
                                });
                                continue;
                            }
                        }
                        else {
                            if (ride.seats < 5) {
                                lyftRideTypes.push({
                                    ride_type: ride.ride_type,
                                    display_name: ride.display_name
                                });
                                continue;
                            }
                        }
                    }
                }
                let lyftHeaders = {
                    'Authorization': 'bearer ' + lyftClientId
                };
                let lyftOptions = {
                    url: 'https://api.lyft.com/v1/cost?start_lat=' + start_lat + '&start_lng=' + start_long + '&end_lat=' + end_lat + '&end_lng=' + end_long,
                    headers: lyftHeaders
                };
                request(lyftOptions, function (error, response, info) {
                    if (error || response.statusCode == 400) {
                        console.log(error);
                        console.log(response.statusCode);
                        let best_lyft_option = {
                            display_name: "Error",
                            driver_time: Number.MAX_SAFE_INTEGER,
                            estimated_distance_miles: Number.MAX_SAFE_INTEGER,
                            estimated_duration_seconds: Number.MAX_SAFE_INTEGER,
                            price: Number.MAX_SAFE_INTEGER,
                            primetime_percentage: "Error",
                            ride_type: "Error"
                        };
                        lyftFlag = true;
                        session.userData.Lyft = best_lyft_option;
                    }
                    else {
                        console.log("Have lyft prices");
                        let body = JSON.parse(info);
                        let lyft_price = 99999;
                        let best_lyft_option = {
                            ride_type: "",
                            estimated_duration_seconds: 0,
                            estimated_distance_miles: 0,
                            price: 0,
                            primetime_percentage: "",
                            driver_time: 0,
                            display_name: ""
                        };
                        for (let index = 0; index < body.cost_estimates.length; index++) {
                            let ride = body.cost_estimates[index];
                            for (let e = 0; e < lyftRideTypes.length; e++) {
                                if (ride.display_name == lyftRideTypes[e].display_name) {
                                    lyftRides.push(ride);
                                }
                            }
                        }
                        for (let index = 0; index < lyftRides.length; index++) {
                            let ride = lyftRides[index];
                            if (index == 0) {
                                lyft_price = ride.estimated_cost_cents_max;
                                best_lyft_option = {
                                    display_name: ride.display_name,
                                    price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 200),
                                    estimated_distance_miles: ride.estimated_distance_miles,
                                    estimated_duration_seconds: ride.estimated_duration_seconds,
                                    primetime_percentage: ride.primetime_percentage,
                                    ride_type: ride.ride_type,
                                    driver_time: 0
                                };
                            }
                            if (ride.estimated_cost_cents_max < lyft_price) {
                                lyft_price = ride.estimated_cost_cents_max;
                                best_lyft_option = {
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
                        let lyftHeaders = {
                            'Authorization': 'bearer ' + lyftClientId
                        };
                        let lyftOptions = {
                            url: 'https://api.lyft.com/v1/eta?lat=' + start_lat + '&lng=' + start_long + '&ride_type=' + best_lyft_option.ride_type,
                            headers: lyftHeaders
                        };
                        request(lyftOptions, function (error, response, info) {
                            if (error || response.statusCode == 400) {
                                console.log(error);
                                console.log(response.statusCode);
                                let best_lyft_option = {
                                    display_name: "Error",
                                    driver_time: Number.MAX_SAFE_INTEGER,
                                    estimated_distance_miles: Number.MAX_SAFE_INTEGER,
                                    estimated_duration_seconds: Number.MAX_SAFE_INTEGER,
                                    price: Number.MAX_SAFE_INTEGER,
                                    primetime_percentage: "Error",
                                    ride_type: "Error"
                                };
                                lyftFlag = true;
                                session.userData.Lyft = best_lyft_option;
                            }
                            else {
                                let body = JSON.parse(info);
                                best_lyft_option.driver_time = body.eta_estimates[0].eta_seconds;
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
        console.log("Finished");
        function Timeout(transit, uber, lyft, next) {
            if (transit && uber && lyft) {
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
    function (session, response, next) {
        console.log("Matching with user preference");
        let preference = session.userData.perference;
        let uber = session.userData.Uber;
        let lyft = session.userData.Lyft;
        let transitInfo = session.userData.Transit;
        let rideshare = {
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
        if (uber.uber_name == "Error" || lyft.display_name == "Error") {
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
            }
        }
        else if (preference == 0) {
            let uberPrice = uber.uber_price;
            let lyftPrice = lyft.price;
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
            let uberDriverTime = uber.uber_driver_time;
            let lyftDriverTime = lyft.driver_time;
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
            let uberPrice = uber.uber_price;
            let lyftPrice = lyft.price;
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
        if (session.message.source != 'skype') {
            let transitMessage = [];
            let rideshareMessage = [];
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
                    ];
            }
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
            let transitString;
            if (transitInfo.transitDistance == "Error") {
                console.log("Building skype error string");
                transitString = 'We could not find transit in this area <br/> <br/>';
            }
            else {
                console.log("Building transit string");
                transitString = `Transit <br/>
                - Departure Time: ${transitInfo.transitDepartureTime} <br/>
                - Arrival Time: ${transitInfo.transitArrivalTime} <br/>
                - Distance: ${transitInfo.transitDistance} miles <br/>
                - Duration ${transitInfo.transitDuration} minutes <br/>`;
            }
            let rideshareString;
            if (rideshare.serviceType == "Error") {
                console.log("Building rideshare error string");
                rideshareString = "We could not find any rideharing options";
            }
            else {
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
        session.userData.Rideshare = rideshare;
        session.replaceDialog("/options");
    }
]);
bot.dialog("/options", [
    function (session) {
        builder.Prompts.choice(session, "Type the number or name to order or get more info or hit finished", ["Transit", 'Rideshare', "Finished"]);
    },
    function (session, response, next) {
        let transit = session.userData.Transit;
        let rideshare = session.userData.Rideshare;
        let startLat = session.userData.start_lat;
        let startLong = session.userData.start_long;
        let endLat = session.userData.end_lat;
        let endLong = session.userData.end_long;
        if (response.response.index == 0) {
            if (transit.transitArrivalTime == "Error") {
                session.send("There was an error when looking for transit in your locations.");
            }
            else {
                let stepMessage = [];
                for (let step = 0; step < transit.transitSteps.length; step++) {
                    if (transit.transitSteps[step].stepTransitMode == "WALKING") {
                        let walkingStep = transit.transitSteps[step];
                        let instructions = [
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
                        ];
                        for (let step = 0; step < walkingStep.stepDeatiledInstructions.length; step++) {
                            if (step == walkingStep.stepDeatiledInstructions.length - 1) {
                                instructions.push({
                                    "type": "TextBlock",
                                    "text": `- Step ${step + 1}: ${walkingStep.stepDeatiledInstructions[step].stepMainInstruction}`,
                                    "wrap": true
                                });
                            }
                            else {
                                instructions.push({
                                    "type": "TextBlock",
                                    "text": `- Step ${step + 1}: ${walkingStep.stepDeatiledInstructions[step].stepMainInstruction}`,
                                    "wrap": true
                                });
                            }
                        }
                        instructions.forEach(step => {
                            stepMessage.push(step);
                        });
                    }
                    else {
                        let transitStep = transit.transitSteps[step];
                        let transitMessage = [
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
                        });
                    }
                }
                let directionMessage = new builder.Message(session)
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
                                "items": stepMessage
                            }
                        ]
                    }
                });
                session.send(directionMessage);
                session.replaceDialog('/options');
            }
        }
        else if (response.response.index == 1) {
            if (rideshare.serviceProvider == "Uber") {
                let uberClientId = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP';
                let pickup = LocationAddressFomater(session.userData.start);
                let dropoff = LocationAddressFomater(session.userData.end);
                let uberString = `https://m.uber.com/ul/?action=setPickup&client_id=${uberClientId}&product_id=${rideshare.proudctId}&pickup[formatted_address]=${pickup}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&dropoff[formatted_address]=${dropoff}&dropoff[latitude]=${endLat}&dropoff[longitude]=${endLong}`;
                let uberCard = new builder.Message(session)
                    .addAttachment(new builder.ThumbnailCard(session)
                    .title("Order an Uber")
                    .text("Click to order your Uber in the Uber App!")
                    .images([builder.CardImage.create(session, 'https://d1a3f4spazzrp4.cloudfront.net/uber-com/1.2.29/d1a3f4spazzrp4.cloudfront.net/images/apple-touch-icon-144x144-279d763222.png')])
                    .buttons([builder.CardAction.openUrl(session, uberString, "Order an Uber")]));
                session.send(uberCard);
            }
            else if (rideshare.serviceProvider == 'Lyft') {
                let clientId = '9LHHn1wknlgs';
                let lyftString = `https://lyft.com/ride?id=${rideshare.proudctId}&pickup[latitude]=${startLat}&pickup[longitude]=${startLong}&partner=${clientId}&destination[latitude]=${endLat}&destination[longitude]=${endLong}`;
                let lyftCard = new builder.Message(session)
                    .addAttachment(new builder.ThumbnailCard(session)
                    .title("Order your Lyft!")
                    .text("Click the button to order your Lyft in the Lyft App!")
                    .images([builder.CardImage.create(session, "https://www.lyft.com/apple-touch-icon-precomposed-152x152.png")])
                    .buttons([builder.CardAction.openUrl(session, lyftString, "Order Lyft")]));
                session.send(lyftCard);
            }
            else {
                session.send("We could not find any ridesharing options here");
            }
            session.replaceDialog('/options');
        }
        else {
            session.endConversation("Thank you for using Travelr! Have a great day!");
        }
    }
]);
bot.dialog("/info", [
    function (session) {
        builder.Prompts.choice(session, "What information would you like to see", "Company Info|Privacy|How It Works|Finished");
    },
    function (session, response, next) {
        if (response.response.index == 0) {
            session.send(`Company Info
            
            Travelr is all about creating a more enjoyable commuting experience.
            
            We are your urban travel guide to make your daily commute better we match your preferences and find the best options 
            avialable for you including price, time, group size, and a luxurious option.

            By connecting users to one another we enhance the quality of everyone's dialy commute. This means that every user
            depending on their choice will be able to find the quickest route, the cheapest ride, or the best luxury deal available.`);
        }
        else if (response.response.index == 1) {
            session.send(`Privacy
            
            Retainment of information

            This bot is currently in beta. We do not ask for nor retain personal information including but not limited to: Name, DOB, Mailing or Biling Address, etc...
            Although, not yet implemented, Travelr does intend to eventually retain your starting location, destiantion, and the best services our system produces. 
            This information will eventually help us with creating a better and faster bot by allowing us to run analysis on the transportation systems in your geographic area.

            Sale of information

            We will not sell the retained informaiton. The informaiton will be used for our own purposes as stated above. We will update our privacy statements accordingly.`);
        }
        else if (response.response.index == 2) {
            session.send(`How It Works

            Travelr asks the user for their commuting preferences and then it asks the user for their starting and ending locations. After
            typing in their preferences and destination our algorithim internally finds the best choice for the user.`);
        }
        else {
            session.send("Returning you back to the help dialog!");
            session.endDialog();
        }
        console.log("Going to the next step");
        next();
    },
    (session) => {
        session.replaceDialog("/info");
    }
]);
bot.dialog('/commands', [
    (session) => {
        session.send("At anytime you can say the following commands: 'cancel', 'restart', 'help'. 'Cancel' stops bot," +
            "'Restart' restarts the current step, and 'Help' launches the help guide");
        session.endDialog("Returning you to the main help dialog!");
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
