"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const builder = require("botbuilder");
const restify = require("restify");
const request = require("request");
const googleMaps = require("@google/maps");
const util = require("util");
let googleMapsClient = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4'
});
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
let connector = new builder.ChatConnector({
    appId: "",
    appPassword: ""
});
let bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
server.get(/.*/, restify.serveStatic({
    'directory': '.',
    'default': 'Index.html'
}));
function HtmlParse(html) {
    html += " ";
    let html_array = html.split("");
    let html_return = '';
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
bot.dialog('/', [
    function (session, args, next) {
        session.send("Hello and welcome to Travelr! We just need a few details to get you to your destination!");
        next();
    },
    function (session) {
        builder.Prompts.choice(session, "What is your preference on transportation?", "Value|Time|Luxury");
    },
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
        next();
    },
    function (session) {
        builder.Prompts.text(session, "What is your starting location?");
    },
    function (session, result, next) {
        session.userData.start = result.response;
        googleMapsClient.geocode({
            address: session.userData.start
        }, function (err, response) {
            if (!err) {
                session.userData.start_lat = response.json.results[0].geometry.location.lat;
                session.userData.start_long = response.json.results[0].geometry.location.lng;
                next();
            }
            else {
            }
        });
    },
    function (session) {
        console.log("Asking for destination");
        builder.Prompts.text(session, "What is your destination?");
    },
    function (session, results, next) {
        console.log("Have the users desstination");
        session.dialogData.end = results.response;
        googleMapsClient.geocode({
            address: results.response
        }, function (err, response) {
            if (!err) {
                session.userData.end_lat = response.json.results[0].
                    geometry.location.lat;
                session.userData.end_long = response.json.results[0].geometry.location.lng;
                next();
            }
            else {
                console.log();
            }
        });
    },
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
                session.send("There was an unknown error getting transit info");
            }
            else {
                console.log("No error in transit");
                console.log(info);
                console.log("\n\n\n\n\n\n\n\n\n");
                let body = JSON.parse(info);
                console.log(util.inspect(body, false, null));
                if (body.status != "OK") {
                    console.log("No transit in area");
                    session.send("Transit is not available in this area.");
                }
                else {
                    console.log("Transit in area");
                    let legs = body.routes;
                    if (legs.steps.length == 1) {
                        console.log("Only 1 step");
                        session.userData.Transit = ('Transit -> Distance: ' + (legs.distance.text) +
                            'Duration: ' + (legs.duration.text) +
                            HtmlParse(legs.steps[0].html_instructions));
                        let g;
                        let google_array = [];
                        for (g in legs.steps[0].steps) {
                            google_array.push(HtmlParse(legs.steps[0].steps[g].html_instructions));
                        }
                        session.userData.google_array = google_array;
                    }
                    else {
                        console.log("Multiple Steps");
                        session.userData.Transit = ("Transit -> Depart Time: " +
                            legs.departure_time.text + " " + "Arrival Time: " +
                            legs.arrival_time.text + " " + "Total Time: " +
                            legs.duration.text + " " + "Total Distance: " +
                            legs.distance.text + " ");
                        let q;
                        let r;
                        let google_array = [];
                        for (q in legs.steps) {
                            let msg = "";
                            if (legs.steps[q].travel_mode == 'WALKING') {
                                msg += (HtmlParse(legs.steps[q].html_instructions));
                                msg += "\n";
                                for (r in legs.steps[q].steps) {
                                    msg += (HtmlParse(legs.steps[q].steps[r].html_instructions));
                                    msg += '\n';
                                }
                                google_array.push(msg);
                            }
                            else {
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
                        session.userData.google_array = google_array;
                        transitFlag = true;
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
            if (error) {
                console.log("Error when getting uber info");
                next();
            }
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
                if (error) {
                    console.log(error);
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
                        if (error) {
                            console.log(error);
                        }
                        else {
                            console.log("Have driver times");
                            let body = JSON.parse(info);
                            best_uber_option.uber_driver_time = body.times[0].estimate;
                            session.userData.Uber = best_uber_option;
                        }
                        uberFlag = true;
                        console.log("Finished Uber Driver Time");
                    });
                }
                console.log("Finished Uber Price");
            });
            console.log("Finished Uber Products Maps");
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
            if (error) {
                console.log(error);
                next();
            }
            console.log("In lyft Ride Types");
            let body = JSON.parse(info);
            for (let index = 0; index < body.ride_types.length; index++) {
                let ride = body.ride_types[index];
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
            let lyftHeaders = {
                'Authorization': 'bearer ' + lyftClientId
            };
            let lyftOptions = {
                url: 'https://api.lyft.com/v1/cost?start_lat=' + start_lat + '&start_lng=' + start_long + '&end_lat=' + end_lat + '&end_lng=' + end_long,
                headers: lyftHeaders
            };
            request(lyftOptions, function (error, response, info) {
                if (error) {
                    console.log(error);
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
                                price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 120),
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
                                price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 120),
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
                        if (error) {
                            console.log(error);
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
        let transitSteps = session.userData.google_array;
        let options;
        let transit;
        let rideshare;
        console.log(uber);
        console.log();
        console.log(lyft);
        console.log();
        console.log(transitInfo);
        console.log();
        console.log(transitSteps);
        console.log();
        if (preference == 0) {
            let uberPrice = uber.uber_price;
            let lyftPrice = lyft.price;
            if (uberPrice < lyftPrice) {
                rideshare =
                    {
                        driverTime: (uber.uber_driver_time / 60).toPrecision(2),
                        price: uberPrice.toPrecision(2),
                        serviceProvider: "Uber",
                        serviceType: uber.uber_name,
                        totalDistance: uber.uber_distance.toPrecision(2),
                        totalTime: (uber.uber_travel_time / 60).toPrecision(2)
                    };
                transit =
                    {
                        mainInfo: transitInfo,
                        steps: transitSteps
                    };
                options =
                    {
                        rideshare: rideshare,
                        transit: transit
                    };
            }
            else {
                rideshare =
                    {
                        driverTime: (lyft.driver_time / 60).toPrecision(2),
                        price: lyft.price.toPrecision(2),
                        serviceProvider: "Lyft",
                        serviceType: lyft.display_name,
                        totalDistance: lyft.estimated_distance_miles.toPrecision(2),
                        totalTime: (lyft.estimated_duration_seconds / 60).toPrecision(2)
                    };
                transit =
                    {
                        mainInfo: transitInfo,
                        steps: transitSteps
                    };
                options =
                    {
                        rideshare: rideshare,
                        transit: transit
                    };
            }
        }
        if (preference == 1) {
            let uberDriverTime = uber.uber_driver_time;
            let lyftDriverTime = lyft.driver_time;
            if (uberDriverTime < lyftDriverTime) {
            }
            else {
            }
        }
        if (preference == 2) {
        }
    }
]);
