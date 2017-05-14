import * as builder from "botbuilder";
import * as restify from "restify";
import * as request from "request";
import * as Uber from "node-uber";
import * as googleMaps from "@google/maps";

let googleMapsClient = googleMaps.createClient({
    key:process.env.GOOGLE_MAPS_KEY
});

// Setup Restify Server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat bot 
let connector: builder.ChatConnector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
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

bot.dialog('/', new builder.IntentDialog()
    .matches('lyft', '/lyft')
    .matches('uber', '/uber')
    .matches('transit', '/transit')
    .onDefault('/waterfall'));

bot.dialog('/waterfall', [

    // send the intro
    function (session: builder.Session, args: any, next): void{
        session.send("Hello and welcome to Travelr! Just tell us where you are going and we will get you there as quickly as possible!");
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
    function (session: builder.Session, result:builder.IPromptTextResult, next): void
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

//=========================================================
// Google Transit
//=========================================================

        googleMapsClient.directions(
            {
                origin:
                {
                    lat: start_lat,
                    lng: start_long
                }, 
                destination:
                {
                    lat: end_lat,
                    lng: end_long
                },
                mode: "transit"
            },

            function(err, response)
            {
                // Check if Error
                if (err)
                {
                    // Send a message to indicate error 
                    console.log(err);
                    session.send("There was an unknown error getting transit info");
                }
                else
                {   
                    console.log("No error in transit");

                    // Check to see if there is no results
                    if (response.json.status == "ZERO_RESULTS" || response.json.status == "NOT_FOUND")
                    {
                        console.log("No transit in area");
                        session.send("Transit is not available in this area.");
                    }

                    else
                    {
                        console.log("Transit in area");
                        
                        // Get the results 
                        let legs: any = response.json.routes[0].legs[0];

                        // If there is only one step
                        if (legs.steps.length == 1)
                        {
                            console.log("Only 1 step");

                            session.send('Transit -> Distance: ' + (legs.distance.text) +
                            'Duration: ' + (legs.duration.text) + 
                            HtmlParse(legs.steps[0].html_instructions) );

                            let g: any;
                            let google_array: any[];

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
                            session.send("Transit -> Depart Time: " + 
                            legs.departure_time.text + " " + "Arrival Time: " + 
                            legs.arrival_time.text + " " + "Total Time: " + 
                            legs.duration.text + " " + "Total Distance: " + 
                            legs.distance.text + " ");

                            let q: string;
                            let r: string;
                            let google_array: any[];

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
                        }
                    }
                }
            } // Ends callback for google 
        ); // Ends google maps transits function 

//=========================================================
// Uber information 
//=========================================================

        console.log("In uber");

        let uber: any = new Uber(
            {
                client_id: '4-FEfPZXTduBZtGu6VqBrTQvg0jZs8WP', //process.env.UBER_APP_ID,
                client_secret: 'vAy-juG54SV15yiv7hsDgVMegvMDPbjbtuayZ48a' ,//process.env.UBER_APP_PASSWORD,
                server_token: '2By_BZgRZCMelkCHxVyWUCcTg1z6UfkPfo7UZM6O' , //process.env.UBER_APP_TOKEN,
                redirect_uri: '',
                name: 'TravelrApp',
            }
        ); // Ends uber call

        console.log("Getting price informaiton for uber");

        // Get the price estimate information
        uber.estimate.getPriceForRouteAsync(start_lat, start_long, 
        end_lat, end_long,
        function(err: any, res: any)
        {
            try
            {
                console.log("Inside try statement");

                // Get the prices
                let prices: any = res.prices;

                // Check to see if there are prices 
                // If not prices available then Uber is not in the area
                if (prices[0] == null)
                {
                    session.send("Uber is not available in this area.");
                }

                // If there is infomration for this area 
                else
                {

                }

            }// end of try

            catch (e)
            {
                console.log("There was an error" + e);
            }

        })// End of uber estimates call
        
    }

    ])  