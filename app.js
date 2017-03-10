var restify = require('restify');
var builder = require('botbuilder');
var request = require('request');
var googleMapsClient = require('@google/maps').createClient({
    key: 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4' 
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
//server.get(/.*/, restify.serveStatic({
	//'directory': '.',
	//'default': 'index.html'
	

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [

    // send the intro
    function (session, args, next){
        session.send("Hello and welcome to Travelr! Just tell \
        us where you are going and we will get you there as quickly as \
        possible!");
        next();
    },

    // get the user's starting location
    function(session){
        builder.Prompts.text(session, "What is your starting location");
    },

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

    /* get uber
    function(session, args, next) {

        
        next();
    }, 

    // get lyft
    function(session, args, next) {

        next();
    },

    */

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
                //console.log(response.json);

                console.log();

                //console.log(response.json.routes);

                console.log();
                
                // get the time, distance, and route
                //console.log(response.json.routes[0].legs);

                console.log();
                var legs = response.json.routes[0].legs[0];
                //console.log(legs);

                // send the depart time 
                session.send("Depart Time: " + legs.departure_time.text);

                // send the arrival time 
                session.send("Arrival Time: " + legs.arrival_time.text);
 
                // send the trip time
                session.send("Total Time: " + legs.duration.text);

                // send the distance 
                session.send("Total Distance: " + legs.distance.text);

                // send the steps
                var f; 
                for (f in legs.steps){console.log(legs.steps[f]);
                    console.log();}

                var q;
                var r; 
                for (q in legs.steps) {

                    var string = ""

                    if (legs.steps[q].travel_mode == 'WALKING')
                    {
                        // log the big instruction 
                        string += (legs.steps[q].html_instructions);
                        string += "\n";

                        for (r in legs.steps[q].steps)
                        {
                            string += (legs.steps[q].steps[r].html_instructions);
                            string += '\n';
                        }
                        session.send(string)
                        console.log();
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

                        console.log();
                        session.send(string);
                    }
                    
                }

                

            }
        
        // clean up
        /*
        session.clearDialogStack();
        session.endDialog();
        session.endConversation();
        */
        });

    }

]);
