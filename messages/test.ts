import * as builder from "botbuilder";
import * as restify from "restify";
import * as process from "process";
import * as azure from "azure-storage";
var server = restify.createServer();

server.listen(process.env.port || process.env.PORT || 3979, function () {
    console.log('%s listening to %s', server.name, server.url);
});
var connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});
server.post('/api/messages', connector.listen());
var bot = new builder.UniversalBot(connector);
var tableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
var entGen = azure.TableUtilities.entityGenerator;
var time = Date.now();
var now = time.toString();

bot.dialog("/", [
    (session, args, next) =>
    {   console.log("Getting choice");
        builder.Prompts.choice(session, "Welcome to the account login! Would you like to 'Sign Up', 'Login', 'Edit', or 'Cancel'?", ['Sign Up', 'Login', 'Edit', 'Cancel']);
    },

    (session, results, next) =>
    {
        console.log("Directing the choice")

        if (results.response.index == 0) // Sign up
        {
            session.beginDialog('/signUp');
        }
        else if (results.response.index == 1) // login
        {

        }
        else if (results.response.index == 2) // edit
        {

        }
        else if (results.resposne.index == 3) // cancel
        {

        }

    } /*,
    (session, results, next) =>
    {
        session.userData.pin = results.response;

        console.log("Getting the user from the table")
        let query = new azure.TableQuery()
            .where('PartitionKey eq ?', session.userData.phone)
            .and("RowKey eq ?", session.userData.pin);
        tableService.queryEntities("User", query, null, function (error, result, response)
        {
            if (error)
            {   
                console.log("There was an error getting the user.")
                console.log(error)
            }
            else
            {
                console.log("User found!")
                console.log(response.body);
                console.log(result.entries);
            }
        })
    }

*/
])

bot.dialog('/signUp', [
    function (session, args, next)
    {
        console.log("In the sign up dialog");
        console.log("Getting the users phone number");
        builder.Prompts.text(session, "Welcome to the sign up dialog! What is your phone number? Your phone number will become your ID.");
    },
    function (session, results, next)
    {
        console.log("Getting the user's pin")
        let phone = results.response.trim()
        let finalPhone = "";

        for (let index = 0; index < phone.length; index++) {
            if (phone[index] == "-")
            {
                continue;
            }
            else
            {
                finalPhone += phone[index]
            }
        }

        session.userData.phone = finalPhone;
        builder.Prompts.text(session, "Great! Now we just need a custom pin. It can be of any length or combination!");
    },

    function (session, results, next)
    {
        console.log("Asking for add to favorites")
        session.userData.pin = results.response;
        builder.Prompts.choice(session, "Would you like to add your favorite places?", ["Yes", "No"])
    }, 

    function (session, results: builder.IPromptChoiceResult, next: any)
    {
        if (results.response.index == 0) // yes
        {   session.send("Awesome, starting the 'Add Favorites' dialog!");
            console.log("starting the add favorites dialog!")
            session.beginDialog('/addFavorites');
        }
        else
        {
            
        }

    }, 
    function (session: builder.Session, args: any, next: any)
    {

        console.log("Building the user's account")
        // build the account
        let UserIDs = 
        {
            ids: [session.message.user.id]
        };
        
        // Check to see if favorite locations have been added 
        let FavoriteLocations = 
        {
            
        };
        if (session.userData.favoriteLocations != undefined)
        {
            let locationsObject = session.userData.favoriteLocations
            for (let key in locationsObject)
            {
                FavoriteLocations[key.toString()] = locationsObject[key.toString()]
            }
        }

        var VisitedLocations = 
        {
            now:
            {
            }
        };

        var Entity = 
        {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Ids: entGen.String(JSON.stringify(UserIDs)),
            Favorite_Locations: entGen.String(JSON.stringify(FavoriteLocations)),
            Visited_Locations: entGen.String(JSON.stringify(VisitedLocations))
        };

        tableService.insertOrReplaceEntity("User", Entity, function (error, result, response)
        {
            if (!error) 
            {
                    console.log("Person added to Table");
                    next();
            }
            else 
            {
                console.log("There was an error adding the person: \n\n");
                console.log(error);
            }   
        })
    }

])

bot.dialog('/addFavorites', [
    
    function (session: builder.Session, args, next: any)
    {
        builder.Prompts.text(session, "What is the name of your favorite location? E.g. 'Work', or 'Home'");
    },

    function (session: builder.Session, results: builder.IPromptTextResult, next: any)
    {
        session.dialogData.tempFavoriteLocationName = results.response;
        builder.Prompts.text(session, "What is the address for that location? E.g. '2200 Main Street Austin, Texas' or '15 and Broadway New York, New York'");
    },

    function (session: builder.Session, results: builder.IPromptTextResult, next: any)
    {
        session.userData.tempFavoriteLocationAddress = results.response;
        builder.Prompts.choice(session, `You said your location name was '${session.dialogData.tempFavoriteLocationName} and the address was ${results.response}. Is that correct?'`, ["Yes", "No"]);
    },
    function(session: builder.Session, results: builder.IPromptChoiceResult, next: any)
    {
        if (results.response.index == 0) // yes, the information is correct
        {
            // add the information to the array of favorite locations
            let tempFavoriteLocationName: string = session.userData.tempFavoriteLocationName;
            let tempFavoriteLocationAddress: string = session.userData.tempFavoriteLocationAddress;
            
            // Check to see if the user already has favorites
            let FavoriteLocation = session.userData.favoriteLocations
            if (FavoriteLocation == undefined) // there is no data
            {
                let FavoriteLocation = 
                {
                    tempFavoriteLocationName: tempFavoriteLocationAddress
                    
                };
                
                // Add the location to the favorite
                session.userData.favoriteLocations = FavoriteLocation;
            }
            else // if the data exists
            {
                FavoriteLocation.tempFavoriteLocationName = tempFavoriteLocationAddress;
                session.userData.favoriteLocations = FavoriteLocation;
            }

            builder.Prompts.choice(session, "Would you like to add another favorite?", ["Yes", "No"]);

        }
        else if (results.response.index == 1) // no they are not correct
        {
            session.send("Okay we will start over");
            session.replaceDialog("/addFavorites");
        }
    },
    
    function (session: builder.Session, results: builder.IPromptChoiceResult, next: any)
    {
        if (results.response.index == 0) // want to add another location
        {
            session.replaceDialog('/addFavorites')
        }
        else if (results.response.index == 1) // do not want to add another 
        {
            session.endDialog("Okay, updating your account!");
        }
    }
])