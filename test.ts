import * as builder from "botbuilder";
import * as restify from "restify";
import * as request from "request";
import * as googleMaps from "@google/maps";
import {Uber} from "./uber";
import {Lyft} from "./lyft";
import {Results} from "./results";
import {Transit} from "./transit";
import * as util from "util"

let googleMapsClient: any = googleMaps.createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4' //process.env.GOOGLE_MAPS_KEY
});

// Setup Restify Server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat bot 
let connector: builder.ChatConnector = new builder.ChatConnector({
    appId: "",//'ff6b4beb-ee93-4e58-87ae-4cdc7d52a67b', //process.env.MICROSOFT_APP_ID,
    appPassword: ""//'4VGq7jLMxiDxDBwoYefSrfg' //process.env.MICROSOFT_APP_PASSWORD
});

let bot: builder.UniversalBot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Serve a static web page
server.get(/.*/, restify.serveStatic({
	'directory': '.',
	'default': 'Index.html'})
);

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


//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [

    // send the intro
    function (session: builder.Session, args: any, next: any): void{
        session.send("Hello and welcome to Travelr! We just need a few details to get you to your destination!");
        next();
    },

    // Get the user's preference
    function (session: builder.Session): void {
        builder.Prompts.choice(session, "What is your preference on transportation?",
        "Value|Time|Luxury");
    }, 
    
    // Save the perference 
    function (session: builder.Session, result: builder.IPromptChoiceResult, 
    next: Function) : void
    {
        switch (result.response.index) 
        {
            case 0:
                session.userData.perference = 0
                break;
            case 1:
                session.userData.perference = 1
                break;
            case 2:
                session.userData.perference = 2;
            default:
                session.userData.perference = 0
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
        next();
    },

    // get the user's starting location
    function(session: builder.Session): void{
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
                address: session.userData.start
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
        session.dialogData.end = results.response;

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

                    next();

                }

                // If there is an error
                else
                {
                    // call the error dialogue
                    // Unable to determine location
                    console.log();
                }
            }
        )
    }, 

//=========================================================
// Map information 
//=========================================================


    // Begin processing the information
    function (session: builder.Session, args: any, next: Function): void
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
                    session.send("There was an unknown error getting transit info");
                }
                else
                {   
                    console.log("No error in transit");

                    // Convert the string into json 

                    console.log(info);
                    console.log("\n\n\n\n\n\n\n\n\n");
                    let body: Transit.IAllTransitInfo = JSON.parse(info);

                    console.log(util.inspect(body, false, null));

                    if (body.status != "OK")
                    {
                        console.log("No transit in area");
                        session.send("Transit is not available in this area.");
                    }
                
                    else
                    {
                        console.log("Transit in area");
                        
                        // Get the results
                        for (let route_step: number = 0; route_step < body.routes.length; route_step++)
                        {
                            let legs: Transit.ILeg[] = body.routes[route_step].legs;

                            // loop through each leg
                            legs.forEach(leg => 
                            {
                                    let steps: Transit.IStep[] = leg.steps
                            });

                        }

                        // If there is only one step
                        if (legs.steps.length == 1)
                        {
                            console.log("Only 1 step");

                            session.userData.Transit = ('Transit -> Distance: ' + (legs.distance.text) +
                            'Duration: ' + (legs.duration.text) + 
                            HtmlParse(legs.steps[0].html_instructions) );

                            let g: any;
                            let google_array: any[] = [];

                            for (g in legs.steps[0].steps)
                            {
                                google_array.push(HtmlParse(legs.steps[0].steps[g].html_instructions));
                            }

                            // Add the google transit information to userdata
                            session.userData.google_array = google_array;
                        }

                        // If there is more than 1 step
                        else
                        {
                            console.log("Multiple Steps");

                            // send the depart time 
                            session.userData.Transit = ("Transit -> Depart Time: " + 
                            legs.departure_time.text + " " + "Arrival Time: " + 
                            legs.arrival_time.text + " " + "Total Time: " + 
                            legs.duration.text + " " + "Total Distance: " + 
                            legs.distance.text + " ");

                            let q: string;
                            let r: string;
                            let google_array: any[] = [];

                            // Get the information from google
                            for (q in legs.steps)
                            {
                                let msg: string = "";

                                if (legs.steps[q].travel_mode == 'WALKING')
                                {
                                    // log the big instruction 
                                    msg += (HtmlParse(legs.steps[q].html_instructions));
                                    msg += "\n";

                                    for (r in legs.steps[q].steps)
                                    {
                                        msg += (HtmlParse(legs.steps[q].steps[r].html_instructions));
                                        msg += '\n';
                                    }
                                    
                                    // add the string to the array
                                    google_array.push(msg);
                                }

                                else
                                {
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

                                    msg += ("Headsign: "+ transit.headsign);
                                    msg += '\n';

                                    
                                    google_array.push(msg);
                                }
                            }

                            // save the transit information
                            session.userData.google_array = google_array;
                            transitFlag = true;
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
            if (error)
            {
                // TODO: skip over uber
                console.log("Error when getting uber info")
                next();
            }


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
                if (error)
                {
                    // Log the error
                    console.log(error);

                    // TODO: Set a flag to not compare Uber informaiton
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
                    request(options, function(error, response, info: string)
                    {
                        if (error)
                        {
                            console.log(error); 

                            // TODO: Make the error work
                            // End the task
                        }
                        else
                        {
                            console.log("Have driver times");

                            // Parse the string into json
                            let body: Uber.DriverTime = JSON.parse(info);

                            best_uber_option.uber_driver_time = body.times[0].estimate;

                            // Set the User data
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
        request(lyftOptions, function(error, response, info: any)
        {
            if (error)
            {
                console.log(error);
                next();
            }

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
                if (error)
                {   
                    console.log(error);
                    // TODO
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
                                price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 120),
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
                                price: ((ride.estimated_cost_cents_max + ride.estimated_cost_cents_min) / 120),
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
                        if (error)
                        {
                            console.log(error);
                            // TODO
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
        });
//=========================================================
// Car2Go information 
//=========================================================


        console.log("Finished");
        function Timeout(transit: boolean, uber: boolean, lyft: boolean, next: Function) {
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
        let transitInfo: string = session.userData.Transit;
        let transitSteps: any = session.userData.google_array;
        let options: Results.IOptions;
        let transit: Results.ITransit;
        let rideshare: Results.IRideshare;

        console.log(uber);
        console.log();
        console.log(lyft);
        console.log();
        console.log(transitInfo);
        console.log();
        console.log(transitSteps);
        console.log();

        // If the preference is for value
        if (preference == 0)
        {
            let uberPrice: number = uber.uber_price;
            let lyftPrice: number = lyft.price;

            // Find the lower price
            if (uberPrice < lyftPrice)
            {   
                rideshare=
                {
                    driverTime: (uber.uber_driver_time / 60).toPrecision(2),
                    price : uberPrice.toPrecision(2),
                    serviceProvider: "Uber",
                    serviceType : uber.uber_name,
                    totalDistance : uber.uber_distance.toPrecision(2),
                    totalTime : (uber.uber_travel_time / 60).toPrecision(2)
                }

                transit =
                {
                    mainInfo: transitInfo,
                    steps: transitSteps
                }

                options = 
                {
                    rideshare: rideshare,
                    transit: transit
                }
            }
            else
            {
                rideshare =
                {
                    driverTime: (lyft.driver_time / 60).toPrecision(2),
                    price : lyft.price.toPrecision(2),
                    serviceProvider: "Lyft",
                    serviceType : lyft.display_name,
                    totalDistance : lyft.estimated_distance_miles.toPrecision(2),
                    totalTime : (lyft.estimated_duration_seconds / 60).toPrecision(2)
                }

                transit =
                {
                    mainInfo: transitInfo,
                    steps: transitSteps
                }

                options = 
                {
                    rideshare: rideshare,
                    transit: transit
                }
            }
        }

        // If preference is for time
        if (preference == 1)
        {
            let uberDriverTime: number = uber.uber_driver_time;
            let lyftDriverTime: number = lyft.driver_time;

            if (uberDriverTime < lyftDriverTime)
            {

            }
            else
            {

            }
        }

        // Preference is for luxury
        if (preference == 2)
        {
            // Use Uber because of lux 
        }

    }

    ])  