var restify = require('restify');
var builder = require('botbuilder');
var request = require('request');
var Uber = require('node-uber');
var googleMapsClient = require('@google/maps').createClient({
    key: process.env.GOOGLE_MAPS_KEY
});

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Serve a static web page
server.get(/.*/, restify.serveStatic({
	'directory': '.',
	'default': 'Index.html'})
);	

// create intents
//var intents = new builder.IntentDialog();


// function to parse html 
function HtmlParse (html) {

    // declare the constants
    html += ' ' 
    var html_array = html.split("");
    var html_return = '';

    // loop through each word 
    for (var i = 0; i < html_array.length; i+= 1)
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

    return (html_return.replace(/  /g, " ").trim());

}

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', new builder.IntentDialog()
    .matches('lyft', '/lyft')
    .matches('uber', '/uber')
    .matches('transit', '/transit')
    .onDefault('/waterfall'));

bot.dialog('/waterfall', [

    // send the intro
    function (session, args, next){
        session.send("Hello and welcome to Travelr! Just tell us where you are going and we will get you there as quickly as possible!");
        next();
    },

    // get the user's starting location
    function(session){
        builder.Prompts.text(session, "What is your starting location?");
    },

//=========================================================
// Google Geolocation
//=========================================================

    // save the result
    function (session, result, next) {
        console.log();
        var test;
        var test2;
        session.userData.start = result.response;

        // call the google maps function to get the coordinates
        googleMapsClient.geocode({
            address: session.userData.start
            }, function(err, response) {
                if (!err) {

                    // get the latitutde
                    test = response.json.results[0].geometry.location.lat;

                    // get the longitude
                    test2 = response.json.results[0].geometry.location.lng
                    
                }
            
            })
        
        setTimeout(function() {
            session.userData.start_lat = test;
            session.userData.start_long = test2;
            next();
        }, 2000);
        
    },

    // get the user's destination location
    function(session) {
        builder.Prompts.text(session, "What is your destination?");
        console.log();
    },

    // save the results
    function(session, results, next) {
        session.userData.end = results.response;
        console.log();

        googleMapsClient.geocode({
            address: session.userData.end
            }, function(err, responses) {
                if (!err) {

                    // get the latitutde
                    session.userData.end_lat = responses.json.results[0].
                    geometry.location.lat;

                    // get the longitude
                    session.userData.end_long = responses.json.results[0].
                    geometry.location.lng
                }
            });

        next();
    },

    // begin processing the information
    function(session, args, next) {
        session.send("Hold on while we get your results!");
        setTimeout(function() {
            next();
        }, 2000);
    },

//=========================================================
// Map information 
//=========================================================

    // Get the map data and sent it to the user
    function(session, args, next)
    {

        // pull down the lats and long
        var start_lat = session.userData.start_lat;
        var end_lat = session.userData.end_lat;
        var start_long = session.userData.start_long;
        var end_long = session.userData.end_long

        var MainUrl = "https://maps.googleapis.com/maps/api/staticmap?";

        var Key = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";

        // place holder value for zoom level
        var intZoom;

        // Check for zoom level
        // Inital check for lats that are short 
        if (Math.abs(start_lat - end_lat) <= 0.1)
        {
            if (Math.abs(start_long - end_long) <= 0.1)
            {
                intZoom = 16;
            }
            
            else if (Math.abs(start_long - end_long) <= 0.5)
            {
                intZoom = 15;
            }

            else if (Math.abs(start_long - end_long) <= 1)
            {
                intZoom = 12;
            }

            else
            {
                intZoom = 8;
            }

        }

        else if (Math.abs(start_lat - end_lat) > .1 && Math.abs(start_lat - end_lat) <= .5)
        {
            if (Math.abs(start_long - end_long) <= 0.1)
            {
                intZoom = 14;
            }
            
            else if (Math.abs(start_long - end_long) <= 0.5)
            {
                intZoom = 12;
            }

            else if (Math.abs(start_long - end_long) <= 1)
            {
                intZoom = 10;
            }

            else
            {
                intZoom = 8;
            }
        }

        else if (Math.abs(start_lat - end_lat) > .5 && Math.abs(start_lat - end_lat) <= 1)
        {
            intZoom = 10;
        }

        else 
        {
            intZoom = 8;
        }



        var Zoom = "zoom=" + intZoom.toString();

        var Size = "&size=640x640";

        var Format = "&format=gif";

        var MarkerStyleStart = "&markers=color:red|label:A|" + start_lat + "," + start_long;  

        var MarkerStyleEnd = "&markers=color:red|label:B|" + end_lat + "," + end_long; 

        var Path = "&path=color:blue|" + session.userData.start_lat + "," + session.userData.start_long + "|" + session.userData.end_lat + "," + session.userData.end_long;

        var Query = MainUrl + Zoom + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key; 

        session.send("Here is a map of your locations");

        // Build the new message 
        var msg = new builder.Message(session)
        .attachments([{
            contentType: "image/gif",
            contentUrl: Query
        }]);

        // Send the message
        session.send(msg);

        next();
    },


//=========================================================
// Google transit information 
//=========================================================

    // get transit
    function(session, arg, next) {

        // blank line
        console.log();

        googleMapsClient.directions({
            origin: {
                lat: session.userData.start_lat,
                lng: session.userData.start_long
            },
            destination: {
                lat: session.userData.end_lat,
                lng: session.userData.end_long
            },
            mode: "transit"
        }, function(err, response) {

            if(!err){

                // get the fair 
                console.log(response.json.status);

                if (response.json.status == "ZERO_RESULTS" || response.json.status == "NOT_FOUND")
                {
                    session.send("Transit is not available in this area.")
                }

                else
                {
                    //console.log();

                    //console.log(response.json.routes);

                    //console.log();
                    
                    // get the time, distance, and route
                    //console.log(response.json.routes[0].legs);

                    console.log();
                    var legs = response.json.routes[0].legs[0];
                
                    //console.log(legs);


                    if (legs.steps.length == 1)
                    {   
                        // send the Distance
                        session.send('Transit -> Distance: ' + (legs.distance.text) +
                        'Duration: ' + (legs.duration.text) + 
                        HtmlParse(legs.steps[0].html_instructions) );

                        // console.log(legs.steps[0].steps);

                        var g;
                        var google_array = [];

                        for (g in legs.steps[0].steps)
                        {
                            google_array.push( HtmlParse(legs.steps[0].steps[g].html_instructions) );
                        }

                        // add the array to the userData
                        session.userData.google_array = google_array;

                    }

                    else
                    {
                        // send the depart time 
                        session.send("Transit -> Depart Time: " + 
                        legs.departure_time.text + " " + "Arrival Time: " + 
                        legs.arrival_time.text + " " + "Total Time: " + 
                        legs.duration.text + " " + "Total Distance: " + 
                        legs.distance.text + " ");

                        // send the steps
                        //var f; 
                        //for (f in legs.steps){console.log(legs.steps[f]);
                            //console.log();}

                        var q;
                        var r; 
                        var google_array = [];
                        for (q in legs.steps) {

                            var string = ""

                            if (legs.steps[q].travel_mode == 'WALKING')
                            {
                                // log the big instruction 
                                string += (HtmlParse(legs.steps[q].html_instructions));
                                string += "\n";

                                for (r in legs.steps[q].steps)
                                {
                                    string += (HtmlParse(legs.steps[q].steps[r].html_instructions));
                                    string += '\n';
                                }
                                
                                // add the string to the array
                                google_array.push(string);
                            }

                            else
                            {
                                // log the main html_instructions
                                console.log(legs.steps[q].html_instructions);

                                string += (legs.steps[q].html_instructions);

                                var transit = legs.steps[q].transit_details; 

                                string += ("Arrival Stop Name:" + transit.arrival_stop.name);
                                string += '\n';

                                string += ("Arrival Time: " + transit.arrival_time.text);
                                string += '\n';

                                string += ("Departure Stop Name: " + transit.departure_stop.name);
                                string += '\n';

                                string += ("Departure Time: " + transit.departure_time.text);
                                string += '\n';

                                string += ("Headsign: "+ transit.headsign);
                                string += '\n';

                                
                                google_array.push(string);
                            }
                        }

                        // save the transit information
                        session.userData.google_array = google_array;

                    } // end else if steps are longer than 1

                } // end else after check for no results     
            }

            else
            {
                console.log(err);
            }   

            next();
        });

    },

//=========================================================
// Uber information 
//=========================================================

    function(session, args, next)
    {
        console.log("in uber");

        // initialize an uber object
        var uber = new Uber({
            client_id: '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP', //process.env.UBER_APP_ID,
            client_secret: 'vAy-juG54SV15yiv7hsDgVMegvMDPbjbtuayZ48a' ,//process.env.UBER_APP_PASSWORD,
            server_token: '2By_BZgRZCMelkCHxVyWUCcTg1z6UfkPfo7UZM6O' , //process.env.UBER_APP_TOKEN,
            redirect_uri: '',
            name: 'TravelrApp',
        });

        // get the price estimate information
        uber.estimates.getPriceForRoute(session.userData.start_lat
        , session.userData.start_long, session.userData.end_lat
        , session.userData.end_long, function(err, res){
        
        try
        {   
            var prices = res.prices;

            console.log(res);

            // check to see if response is empty
            if (prices[0] == null)
            {
                session.send("Uber is not available in this area.");
            }

            else
            {
                // send the duration and the distance 
                var duration = prices[0].duration / 60;
                session.send("Uber:  Duration: " + duration.toString() + "  minutes" +
                "Distance: " + prices[0].distance + "  miles");

                var u;
                var uber_array = [];
                

                for (u in prices) 
                {
                    // blank string to hold the stats
                    var uber_dict = {
                        "Name": prices[u].localized_display_name,
                        "Surge Multipler": prices[u].surge_multiplier,
                        "Estimate": prices[u].estimate
                    };

                    // check to see if the uberx
                    // send the information for the cheapest one
                    if (prices[u].localized_display_name.toLowerCase() == 'uberx')
                    {   
                        var uber_string = '';

                        for (var element in uber_dict)
                        {
                            uber_string += element.toString() + ":  " + uber_dict[element] + " ";
                        }

                        session.send(uber_string);
                    }

                    // send uber array 
                    uber_array.push(uber_dict);

                } // end the for loop

                uber.estimates.
                getETAForLocationAsync(session.userData.start_lat, 
                session.userData.start_long, function(err, res)
                {
                    if(err)
                    {
                        console.log(err);
                    } // end if err

                    else
                    {
                        var times = res.times;

                        if (times[0] == null)
                        {
                            console.log("No times");
                        }

                        else
                        {
                            for (var ut in times)
                            {
                                for (var ua in uber_array)
                                {
                                    if (times[ut].localized_display_name == uber_array[ua].Name)
                                    {
                                        uber_array[ua].Time = ((times[ut].estimate/60).toString() + " Minutes Away");
                                    }

                                    else
                                    {
                                        continue;
                                    }
                                }
                            }
                            
                        }  // else for if data is sent

                    } // end else - res 
                })

                // save the array to user data 
                session.userData.uber_array = uber_array;

            } // ends else in uber
        
        } // ends try

        catch (err)
        {
            session.send("An error occured while searching for uber in this location." +
            "It may not be available in this area. Please check your locations!")

            console.log(err);
        }
            
    }); // end of uber function for price estimates

        // advance to next step
        next();
    },

//=========================================================
// Lyft Information
//=========================================================
    function (session, args, next)
    {
        
        var access_token; 

        var headers = {
            'Content-Type': 'application/json'
        };

        var dataString = '{"grant_type": "client_credentials", "scope": "public"}';
        
        var options = {
            url: 'https://api.lyft.com/oauth/token',
            method: 'POST',
            headers: headers,
            body: dataString,
            auth: {
                'user': '9LHHn1wknlgs', //process.env.LYFT_APP_ID,
                'pass': '9Jz-WN7J3dMoVFcMhw9wGtVcDg1fK1gV' //process.env.LYFT_APP_PASSWORD
            }
        };

        request(options, function(err, obj, res){
            if (err){
                console.log(err);
            }
            else
            {
                // get the access token 
                var parsed = JSON.parse(res);
                var access_token = parsed.access_token;
                console.log(res);
                console.log(access_token);

                var headers = {
                     'Authorization': 'bearer ' + access_token
                };

                var url_lyft = 'https://api.lyft.com/v1/cost?start_lat=' + 
                    session.userData.start_lat + '&start_lng=' + 
                    session.userData.start_long + '&end_lat=' +
                    session.userData.end_lat + '&end_lng=' +
                    session.userData.end_long;


                // create the get request 
                var options = {
                    url: url_lyft,
                    method: "GET",
                    headers: headers,
                };

                request(options, function(err, obj, res)
                {

                    try
                    {
                        if (err)
                        {
                            console.log(err);
                        } // end if 

                        else
                        {
                            // parse the json 
                            var lyft_pared = JSON.parse(res);
                            console.log(lyft_pared);

                            if (lyft_pared.error)
                            {
                                session.send("Lyft is not available in this area --> " + lyft_pared.error_description);
                            } // end if 

                            else
                            {   

                                var duration = (lyft_pared.cost_estimates[0].estimated_duration_seconds / 60).toFixed(2);

                                session.send("Lyft: " +
                                'Distance: ' + lyft_pared.cost_estimates[0]
                                .estimated_distance_miles + ' miles   ' + 
                                "Duration: " + duration + ' minutes  ');

                                var l; 
                                var lyft_array = [];
                                for (l in lyft_pared.cost_estimates)
                                {
                                    
                                    // get the cost informaiton
                                    var cost_min = lyft_pared.cost_estimates[l].estimated_cost_cents_min / 100;
                                    var cost_max = lyft_pared.cost_estimates[l].estimated_cost_cents_max / 100;
                                    var cost_string = "$" + cost_min.toString() + "--" + cost_max.toString();

                                    // string to hold information
                                    var lyft_dict = 
                                    {
                                        "Ride Type": lyft_pared.cost_estimates[l].display_name,
                                        "Cost Estimate": cost_string,
                                        "Primetime Percentage": lyft_pared.cost_estimates[l].primetime_percentage
                                    }

                                    // check to see if name is lyft
                                    // send the cheapest information
                                    if (lyft_pared.cost_estimates[l].ride_type.toLowerCase() == 'lyft')
                                    {
                                        var lyft_string = "";

                                        for (var ls in lyft_dict)
                                        {
                                            lyft_string += ls.toString() + ":  " + lyft_dict[ls] + "-->";
                                        }

                                        // send the basic info
                                        session.send(lyft_string);

                                    } // end if

                                    // push the information to the array
                                    lyft_array.push(lyft_dict);

                                } // end for

                            } // end else 

                        } // end else

                        // Lyft for ETA Drivers

                        var headers = 
                        {
                        'Authorization': 'bearer ' + access_token
                        };

                        var url_lyft = 'https://api.lyft.com/v1/eta?lat=' + 
                            session.userData.start_lat + '&lng=' + 
                            session.userData.start_long;

                        // create the get request 
                        var options = {
                            url: url_lyft,
                            method: "GET",
                            headers: headers,
                        };

                        // send the request to get the driver eta
                        request(options, function(error, response, body)
                        {
                            if(error)
                            {
                                console.log(error);
                            }

                            else
                            {
                                var lyft_pared_eta = JSON.parse(body);
                                console.log(lyft_pared_eta);

                                // loop through the array
                                // place the time information in lyft_dict
                                for (var la in lyft_pared_eta["eta_estimates"])
                                {
                                    for (var lt in lyft_array)
                                    {
                                        if (lyft_pared_eta['eta_estimates'][la]["display_name"] == lyft_array[lt]["Ride Type"])
                                        {
                                            lyft_array[lt].Driver = ((lyft_pared_eta['eta_estimates'][la]["eta_seconds"] / 60).toString() + " Minutes Away");
                                        }
                                        else
                                        {
                                            continue
                                        }
                                    }
                                }

                                // save the information
                                session.userData.lyft_array = lyft_array;
                            }

                        }) // end request for driver eta 

                    } // end try

                    catch (err)
                    {
                        session.send("An error occured while looking searching for Lyft in this location" +
                        "Lyft may not be available in this area. Please check your location.");

                    } // end catch

                }); // end request to Lyft for Info

            } // end else after initial request for token

        }); // end request for token

        next();
    } ,

    function (session, args, next)
    {
        session.sendBatch();

        setTimeout(function() {
            builder.Prompts.choice(session, "Want more info? Type the number",
            "Transit|Uber|Lyft");
        }, 4000);
        
    },

    function (session, results, next) 
    {
        // check to see if results error

        if (results.response.entity.toLowerCase() == "lyft" || 
        results.response.index == 2)
        {
            session.beginDialog('/lyft');
        }

        else if (results.response.entity.toLowerCase() == "uber" ||
        results.response.index == 1)
        {
            session.beginDialog('/uber');
        }

        else if (results.response.entity.toLowerCase() == "transit" ||
        results.response.index == 0)
        {
            session.beginDialog('/transit');
        }
        else
        {
            session.endDialog();
            session.endConversation();
        } 
    }
]);

bot.dialog('/lyft', [

    function (session)
    {   
        // Tell the customer they are getting lyft information
        session.send("Okay let me send you the information on Lyft")

        // holding variable to loop through lyft_dialog
        var ld;
        
        // local variable of the lyft information
        var lyft_array = session.userData.lyft_array;

        // loop through the array and its parts
        for (var la in lyft_array)
        {
            // create a holding variable 
            var lyft_string = "";

            // loop through the objects within the array
            for (var lp in lyft_array[la])
            {
                lyft_string += (lp + ": " + lyft_array[la][lp] + "-->" );
            }

            // send the information to the user 
            session.send(lyft_string);
        }

        session.endDialog();
    },

    function (session)
    {
        session.endConversation();
    }
])

bot.dialog('/uber', [
    
    function (session)
    {
        // Tell customer we are getting uber information
        session.send("Okay let me send you the information on Uber")

        // holding variable to loop through the Uber Dialogs
        var ud;

        // local variable to go through the array of strings
        var uber_array = session.userData.uber_array;

        // for loop to go through the array of strings
        for (ud in uber_array)
        {
            var uber_string = "";

            for (var ub in uber_array[ud])
            {
                uber_string += (ub + ": " + uber_array[ud][ub] + "--> ");
            }

            session.send(uber_string);
        }

        session.endDialog();
    }
])

bot.dialog('/transit', [

    function(session)
    {
        // Tell customer we are getting transit information
        session.send("Okay let me send you the information on Transit")

        // holding variable to loop through the Uber Dialogs
        var gd;

        // local variable to go through the array of strings
        var google_array = session.userData.google_array;

        // for loop to go through the array of strings
        for (gd in google_array)
        {
            session.send(google_array[gd]);
        }

        session.endDialog();
    }
])
