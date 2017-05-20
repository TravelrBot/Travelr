"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder = require("botbuilder");
const restify = require("restify");
const request = require("request");
const googleMaps = require("@google/maps");
let googleMapsClient = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4' //process.env.GOOGLE_MAPS_KEY
});
// Setup Restify Server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
// Create chat bot 
let connector = new builder.ChatConnector({
    appId: "",
    appPassword: "" //'4VGq7jLMxiDxDBwoYefSrfg' //process.env.MICROSOFT_APP_PASSWORD
});
let bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
// Serve a static web page
server.get(/.*/, restify.serveStatic({
    'directory': '.',
    'default': 'Index.html'
}));
function HtmlParse(html) {
    html += " ";
    let html_array = html.split("");
    let html_return = '';
    // loop through each word 
    for (let i = 0; i < html_array.length; i += 1) {
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
            address: session.userData.start
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
        session.dialogData.end = results.response;
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
        let start_lat = session.userData.start_lat;
        let end_lat = session.userData.end_lat;
        let start_long = session.userData.start_long;
        let end_long = session.userData.end_long;
        let MainUrl = "https://maps.googleapis.com/maps/api/staticmap?";
        let Key = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";
        // Set the constants
        let Size = "&size=640x640";
        let Format = "&format=gif";
        let MarkerStyleStart = "&markers=color:red|label:A|" + start_lat + "," + start_long;
        let MarkerStyleEnd = "&markers=color:red|label:B|" + end_lat + "," + end_long;
        let Path = "&path=color:blue|" + session.userData.start_lat + "," + session.userData.start_long + "|" + session.userData.end_lat + "," + session.userData.end_long;
        let Query = MainUrl + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key;
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
        const start_lat = session.userData.start_lat;
        const end_lat = session.userData.end_lat;
        const start_long = session.userData.start_long;
        const end_long = session.userData.end_long;
        //=========================================================
        // Google Transit
        //=========================================================
        googleMapsClient.directions({
            origin: {
                lat: start_lat,
                lng: start_long
            },
            destination: {
                lat: end_lat,
                lng: end_long
            },
            mode: "transit"
        }, function (err, response) {
            // Check if Error
            if (err) {
                // Send a message to indicate error 
                console.log(err);
                session.send("There was an unknown error getting transit info");
            }
            else {
                console.log("No error in transit");
                // Check to see if there is no results
                if (response.json.status == "ZERO_RESULTS" || response.json.status == "NOT_FOUND") {
                    console.log("No transit in area");
                    session.send("Transit is not available in this area.");
                }
                else {
                    console.log("Transit in area");
                    // Get the results 
                    let legs = response.json.routes[0].legs[0];
                    // If there is only one step
                    if (legs.steps.length == 1) {
                        console.log("Only 1 step");
                        session.send('Transit -> Distance: ' + (legs.distance.text) +
                            'Duration: ' + (legs.duration.text) +
                            HtmlParse(legs.steps[0].html_instructions));
                        let g;
                        let google_array = [];
                        for (g in legs.steps[0].steps) {
                            google_array.push(HtmlParse(legs.steps[0].steps[g].html_instructions));
                        }
                        // Add the google transit information to userdata
                        session.userData.google_array = google_array;
                    }
                    else {
                        console.log("Multiple Steps");
                        // send the depart time 
                        session.send("Transit -> Depart Time: " +
                            legs.departure_time.text + " " + "Arrival Time: " +
                            legs.arrival_time.text + " " + "Total Time: " +
                            legs.duration.text + " " + "Total Distance: " +
                            legs.distance.text + " ");
                        let q;
                        let r;
                        let google_array = [];
                        // Get the information from google
                        for (q in legs.steps) {
                            let msg = "";
                            if (legs.steps[q].travel_mode == 'WALKING') {
                                // log the big instruction 
                                msg += (HtmlParse(legs.steps[q].html_instructions));
                                msg += "\n";
                                for (r in legs.steps[q].steps) {
                                    msg += (HtmlParse(legs.steps[q].steps[r].html_instructions));
                                    msg += '\n';
                                }
                                // add the string to the array
                                google_array.push(msg);
                            }
                            else {
                                // log the main html_instructions
                                console.log(legs.steps[q].html_instructions);
                                msg += (legs.steps[q].html_instructions);
                                var transit = legs.steps[q].transit_details;
                                msg += ("Arrival Stop Name:" + transit.arrival_stop.name);
                                msg += '\n';
                                msg += ("Arrival Time: " + transit.arrival_time.text);
                                msg += '\n';
                                msg += ("Departure Stop Name: " + transit.departure_stop.name);
                                msg += '\n';
                                msg += ("Departure Time: " + transit.departure_time.text);
                                msg += '\n';
                                msg += ("Headsign: " + transit.headsign);
                                msg += '\n';
                                google_array.push(msg);
                            }
                        }
                        // save the transit information
                        session.userData.google_array = google_array;
                    }
                }
            }
        } // Ends callback for google 
        ); // Ends google maps transits function 
        //=========================================================
        // Uber information 
        //=========================================================
        console.log("In uber");
        // Set all of the constants
        const client_id = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP'; //process.env.UBER_APP_ID,
        const client_secret = 'vAy-juG54SV15yiv7hsDgVMegvMDPbjbtuayZ48a'; //process.env.UBER_APP_PASSWORD,
        let server_token = 'CSQlbbbn6k0gbYZULEqiLk0cwUy03ZIPkIYxPrOs'; //process.env.UBER_APP_TOKEN,
        const perference = session.userData.perference;
        const group = session.userData.group;
        let rides = [];
        // Send the request for products
        // This is where we will check for seat capcaity and or luxury options
        // This is mainly to exclude certain options, not to include
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
            if (error) {
                // TODO: skip over uber
                console.log("Error when getting uber info");
                next();
            }
            let body = JSON.parse(info);
            for (let index = 0; index < body.products.length; index++) {
                console.log("Got Uber Product info");
                let ride = body.products[index];
                if (perference != 2) {
                    if (ride.display_name == "SELECT" || ride.display_name == "BLACK" || ride.display_name == "SUV") {
                        rides.push({ display_name: ride.display_name });
                    }
                }
                if (group) {
                    if (ride.capacity < 4) {
                        rides.push({ display_name: ride.display_name });
                        continue;
                    }
                }
                if (!group) {
                    if (ride.capacity > 4) {
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
                let body = JSON.parse(info);
                let product = [];
                // Set variables to hold the infomration
                let uber_price = 99999;
                let best_uber_option = {
                    uber_distance: 0,
                    uber_driver_time: 0,
                    uber_name: "",
                    uber_price: 0,
                    uber_productId: "",
                    uber_travel_time: 0
                };
                // Check to see if error 
                if (error) {
                    // Log the error
                    console.log(error);
                    // TODO: Set a flag to not compare Uber informaiton
                }
                else {
                    console.log("Have Uber prices");
                    // Loop through each ride and match with product information 
                    for (let index = 0; index < body.prices.length; index++) {
                        let ride = body.prices[index];
                        // Check to see if the product matches the terms already
                        for (let e = 0; e < rides.length; e++) {
                            if (ride.display_name == rides[e].display_name) {
                                // Add the price info to the product array
                                product.push(ride);
                            }
                        }
                    }
                    // Now compare and find the cheapest price 
                    for (let index = 0; index < product.length; index++) {
                        // Create a holding variable
                        let ride = product[index];
                        // If index is 0 set the base price to that index
                        if (index == 0) {
                            // Change the pricing informaiton
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
                    if (error) {
                        console.log(error);
                        // TODO: Make the error work
                        // End the task
                    }
                    else {
                        console.log("Have driver times");
                        // Parse the string into json
                        let body = JSON.parse(info);
                        best_uber_option.uber_driver_time = body.times[0].estimate;
                        // Set the User data
                        session.userData.Uber = best_uber_option;
                    }
                    console.log("Finished Uber Driver Time");
                });
                console.log("Finished Uber Price");
            });
            console.log("Finished Google Maps");
        });
        //=========================================================
        // Lyft information 
        //=========================================================
        //=========================================================
        // Car2Go information 
        //=========================================================
        //=========================================================
        // Match with user perferences 
        //=========================================================
        console.log("Finished");
    }
]);
