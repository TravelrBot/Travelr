"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder = require("botbuilder");
const restify = require("restify");
const request = require("request");
const googleMaps = require("@google/maps");
let googleMapsClient = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4'
});
    // Setup Restify Server
    var server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3978, function () {
        console.log('%s listening to %s', server.name, server.url);
    });
    // Create chat bot 
    var connector = new builder.ChatConnector({
        appId: "",
        appPassword: "" //'4VGq7jLMxiDxDBwoYefSrfg' //process.env.MICROSOFT_APP_PASSWORD
    });
    var bot = new builder.UniversalBot(connector);
    server.post('/api/messages', connector.listen());
    // Serve a static web page
    server.get(/.*/, restify.serveStatic({
        'directory': '.',
        'default': 'Index.html'
    }));
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
            var transitFlag = true;
            var uberFlag = true;
            var lyftFlag = true;
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
                        var legs = response.json.routes[0].legs[0];
                        // If there is only one step
                        if (legs.steps.length == 1) {
                            console.log("Only 1 step");
                            session.userData.Transit = ('Transit -> Distance: ' + (legs.distance.text) +
                                'Duration: ' + (legs.duration.text) +
                                HtmlParse(legs.steps[0].html_instructions));
                            var g = void 0;
                            var google_array = [];
                            for (g in legs.steps[0].steps) {
                                google_array.push(HtmlParse(legs.steps[0].steps[g].html_instructions));
                            }
                            // Add the google transit information to userdata
                            session.userData.google_array = google_array;
                        }
                        else {
                            console.log("Multiple Steps");
                            // send the depart time 
                            session.userData.Transit = ("Transit -> Depart Time: " +
                                legs.departure_time.text + " " + "Arrival Time: " +
                                legs.arrival_time.text + " " + "Total Time: " +
                                legs.duration.text + " " + "Total Distance: " +
                                legs.distance.text + " ");
                            var q = void 0;
                            var r = void 0;
                            var google_array = [];
                            // Get the information from google
                            for (q in legs.steps) {
                                var msg = "";
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
                            transitFlag = false;
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
            var client_id = '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP'; //process.env.UBER_APP_ID,
            var client_secret = 'vAy-juG54SV15yiv7hsDgVMegvMDPbjbtuayZ48a'; //process.env.UBER_APP_PASSWORD,
            var server_token = 'CSQlbbbn6k0gbYZULEqiLk0cwUy03ZIPkIYxPrOs'; //process.env.UBER_APP_TOKEN,
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
                if (error) {
                    // TODO: skip over uber
                    console.log("Error when getting uber info");
                    next();
                }
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
                        if (ride.capacity < 4) {
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
                    if (error) {
                        // Log the error
                        console.log(error);
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
                            }
                            else {
                                console.log("Have driver times");
                                // Parse the string into json
                                var body_1 = JSON.parse(info);
                                best_uber_option.uber_driver_time = body_1.times[0].estimate;
                                // Set the User data
                                session.userData.Uber = best_uber_option;
                            }
                            uberFlag = false;
                            console.log("Finished Uber Driver Time");
                        });
                    }
                    console.log("Finished Uber Price");
                });
                console.log("Finished Uber Products Maps");
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
                if (error) {
                    console.log(error);
                    next();
                }
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
                var lyftHeaders = {
                    'Authorization': 'bearer ' + lyftClientId
                };
                var lyftOptions = {
                    url: 'https://api.lyft.com/v1/cost?start_lat=' + start_lat + '&start_lng=' + start_long + '&end_lat=' + end_lat + '&end_lng=' + end_long,
                    headers: lyftHeaders
                };
                // Send the request
                request(lyftOptions, function (error, response, info) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log("Have lyft prices");
                        var body_2 = JSON.parse(info);
                        // Lyft prices
                        var lyft_price = 99999;
                        var best_lyft_option_1 = {
                            ride_type: "",
                            estimated_duration_seconds: 0,
                            estimated_distance_miles: 0,
                            estimated_cost_cents_max: 0,
                            primetime_percentage: "",
                            estimated_cost_cents_min: 0,
                            display_name: "",
                            driver_time: 0
                        };
                        // Loop through each ride and match with previous information
                        for (var index = 0; index < body_2.cost_estimates.length; index++) {
                            var ride = body_2.cost_estimates[index];
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
                                    estimated_cost_cents_max: ride.estimated_cost_cents_max,
                                    estimated_cost_cents_min: ride.estimated_cost_cents_min,
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
                                    estimated_cost_cents_max: ride.estimated_cost_cents_max,
                                    estimated_cost_cents_min: ride.estimated_cost_cents_min,
                                    estimated_distance_miles: ride.estimated_distance_miles,
                                    estimated_duration_seconds: ride.estimated_duration_seconds,
                                    primetime_percentage: ride.primetime_percentage,
                                    ride_type: ride.ride_type,
                                    driver_time: 0
                                };
                            }
                        }
                        // Send the new request for Driver Times
                        var lyftHeaders_1 = {
                            'Authorization': 'bearer ' + lyftClientId
                        };
                        var lyftOptions_1 = {
                            url: 'https://api.lyft.com/v1/eta?lat=' + start_lat + '&lng=' + start_long + '&ride_type=' + best_lyft_option_1.ride_type,
                            headers: lyftHeaders_1
                        };
                        // Send the request for Driver times
                        request(lyftOptions_1, function (error, response, info) {
                            if (error) {
                                console.log(error);
                            }
                            else {
                                // Parse the JSON
                                var body_3 = JSON.parse(info);
                                // Set the Driver time
                                best_lyft_option_1.driver_time = body_3.eta_estimates[0].eta_seconds;
                                // Save the info to user data
                                session.userData.Lyft = best_lyft_option_1;
                            }
                            lyftFlag = false;
                            console.log("Finished Lyft Time");
                        });
                    }
                    console.log("Finished Lyft Price");
                });
                console.log("Finished All of Lyft");
            });
            //=========================================================
            // Car2Go information 
            //=========================================================
            console.log("Finished");
            
            

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
            var transitSteps = session.userData.google_array;
            console.log(uber);
            console.log();
            console.log(lyft);
            console.log();
            console.log(transitInfo);
            console.log();
            console.log(transitSteps);
            console.log();
            // If the preference is for value
            if (preference == 0) {
            }
            // If preference is for time0
            if (preference == 1) {
            }
            // Preference is for luxury
            if (preference == 2) {
            }
        }
    ]);