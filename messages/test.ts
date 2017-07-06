import * as builder from "botbuilder";
import * as restify from "restify";
import * as process from "process";
import * as botbuilder_azure from "botbuilder-azure";
import * as azure from 'azure-storage';
import * as locationDialog from 'botbuilder-location';
var server = restify.createServer();

server.listen(process.env.port || process.env.PORT || 3979, function () {
    console.log('%s listening to %s', server.name, server.url);
});
var connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});
server.post('/api/messages', connector.listen());

var tableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
let AzureTableClient = new botbuilder_azure.AzureTableClient("BotStorage", "travelrbotc4g2ai", 
    'cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==')

let UserTable = new botbuilder_azure.AzureBotStorage({gzipData: false}, AzureTableClient)
let bot: builder.UniversalBot = new builder.UniversalBot(connector).set('storage', UserTable)
var entGen = azure.TableUtilities.entityGenerator;
var time = Date.now();
var now = time.toString();

bot.library(locationDialog.createLibrary("Ag2_gxEa3qcbVGAeEqKMcPptES--_GKGXIFi5TJl8Z2kuGF5BVxIXuVn3LIkdGSr"));

bot.dialog("/", [
    function (session: builder.Session)
    {
        
    }
])

/*function PhoneStrip(phone: string): string
{
    let finalPhone: string = '';
    for (let index = 0; index < phone.length; index++) 
    {
        if (phone[index] == "-")
        {
            continue;
        }
        else
        {
            finalPhone += phone[index]
        }
    }

    return finalPhone;
}

bot.dialog("/account", [
    (session, args, next) =>
    {
        console.log("Getting choice");
        builder.Prompts.choice(session, "Welcome to the account settings! Would you like to 'Sign Up', 'Login', 'Edit', or 'Cancel'?", ['Sign Up', 'Login', 'Edit', 'Cancel']);
    },

    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        console.log("Directing the choice")

        if (results.response.index == 0) // Sign up
        {
            session.beginDialog('/signUp');
        }
        else if (results.response.index == 1) // login
        {
            session.beginDialog('/login');
        }
        else if (results.response.index == 2) // edit
        {
            session.beginDialog('/edit')
        }
        else if (results.resposne.index == 3) // cancel
        {
            session.endDialog("Okay returning you to the main menu!")
        }

    },
    (session: builder.Session, results: builder.IDialogResult<any>, next: any) =>
    {
        if (results.resumed == builder.ResumeReason.completed)
        {
            session.replaceDialog('/');
        }
    } 
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
        let phone = results.response.trim();
        let finalPhone = PhoneStrip(phone);

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
            let response: builder.Session = session.beginDialog('/addFavorites');
        }
        else // no
        {
            next()
        }

    }, 
    function (session: builder.Session, args: any, next: any)
    {

        console.log("Building the user's account")
        // build the account
        
        // Check to see if favorite locations have been added 
        let FavoriteLocations = 
        {
            
        };
        if (session.userData.favoriteLocations)
        {
            let locationsObject = session.userData.favoriteLocations
            for (let key in locationsObject)
            {
                FavoriteLocations[key.toString()] = locationsObject[key.toString()]
            }
        }

        var VisitedLocations = 
        {
            [now]:
            {
            }
        };

        var Entity = 
        {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Favorite_Locations: entGen.String(JSON.stringify(FavoriteLocations)),
            Visited_Locations: entGen.String(JSON.stringify(VisitedLocations))
        };

        tableService.insertOrReplaceEntity("User", Entity, function (error, result, response)
        {
            if (!error) 
            {
                    console.log("Person added to Table");
                    session.userData.favoriteLocations = FavoriteLocations;
                    session.endDialog("Your account has been updated. And you have been signed in!");
            }
            else 
            {
                console.log("There was an error adding the person: \n\n");
                session.endDialog("There was an error updating your account");
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
        session.dialogData.tempFavoriteLocationAddress = results.response;
        builder.Prompts.choice(session, `You said your location name was '${session.dialogData.tempFavoriteLocationName} and the address was ${results.response}. Is that correct?'`, ["Yes", "No"]);
    },
    function(session: builder.Session, results: builder.IPromptChoiceResult, next: any)
    {
        if (results.response.index == 0) // yes, the information is correct
        {
            // add the information to the array of favorite locations
            let tempFavoriteLocationName: string = session.dialogData.tempFavoriteLocationName;
            let tempFavoriteLocationAddress: string = session.dialogData.tempFavoriteLocationAddress;
            
            // Check to see if the user already has favorites
            let FavoriteLocation = session.userData.favoriteLocations
            if (!FavoriteLocation) // there is no data
            {
                console.log("There are no favorite locations");
                let FavoriteLocation = {};

                FavoriteLocation[tempFavoriteLocationName] = tempFavoriteLocationAddress
                
                // Add the location to the favorite
                session.userData.favoriteLocations = FavoriteLocation;
            }
            else // if the data exists
            {
                console.log("Add a new favorite location");
                FavoriteLocation[tempFavoriteLocationName] = tempFavoriteLocationAddress;
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

bot.dialog('/removeFavorites', [
    (session: builder.Session, results: any, next: any) =>
    {
        // Add the favorites to the string array
        let favorites: string[] = ["Cancel"];
        console.log(session.userData.favoriteLocations);
        let favoriteLocations: any = session.userData.favoriteLocations
        for (let key in favoriteLocations)
        {
            favorites.push(key);
        }

        builder.Prompts.choice(session, "Which location would you like to remove from favorites?", favorites);
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        let favoriteLocations: any = session.userData.favoriteLocations
        for (let key in favoriteLocations)
        {
            if (key == results.response.entity)
            {
                delete favoriteLocations[key]
            }
        }

        // upload the new favorite locations to userData
        session.userData.favoriteLocations = favoriteLocations;
        session.endDialog();
    }
])

bot.dialog('/login', [
    (session: builder.Session, results: any, next: any) =>
    {
        builder.Prompts.text(session, "Welcome to the 'Login Dialog'. What is your Phone Number?");
    },
    (session: builder.Session, results: builder.IPromptTextResult, next: any) =>
    {
        if (results.response)
        {
            session.dialogData.phone = PhoneStrip(results.response)
        };

        builder.Prompts.text(session, "What is your pin?")

    },
    (session: builder.Session, results: builder.IPromptTextResult, next: any) =>
    {
        session.dialogData.pin = results.response;

        console.log("Getting the user from the table")
        let query = new azure.TableQuery()
            .where('PartitionKey eq ?', session.dialogData.phone)
            .and("RowKey eq ?", session.dialogData.pin);
        tableService.queryEntities("User", query, null, function (error, result, response)
        {
            if (error)
            {   
                console.log("There was an error getting the user.")
                console.log(error)
                builder.Prompts.text(session, "There was an unknown error finding your account. Would you like to try again?", ["Yes", "No"]);
            }
            else
            {
                console.log("No Error!")

                // Check to see if the user was found
                if (result.entries.length == 0)
                {
                    builder.Prompts.choice(session, "We could not find your account. Would you like to try again?", ["Yes", "No"]);
                }
                else
                {
                    // Get all of the locations and restore the account
                    console.log(result.entries[0].Favorite_Locations._);

                    session.userData.favoriteLocations = JSON.parse(result.entries[0].Favorite_Locations._);
                    session.userData.phone = session.dialogData.phone;
                    session.userData.pin = session.dialogData.pin;
                    session.endDialog("We found your account! You are now logged in. ")
                }
            }
        })
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response.index == 0) // yes, try again
        {
            session.replaceDialog('/login');
        }
        else
        {
            session.endDialog("Okay I am returning you to the previous dialog.");
        }
    }

])

bot.dialog('/edit', [

    (session: builder.Session, args: any, next: any) =>
    {
        session.send("Welcome to the 'Account Edit Dialog! We need to make sure you are logged in in first!'")

        // check to see if there is user data
        // Go to the next step in the waterfall
        if (session.userData.phone && session.userData.pin)
        {
            next();
        }
        else
        {
            session.beginDialog("/login")
        }
    },
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        builder.Prompts.choice(session,"Awesome, we have your info. What would you like to do next?", ["Remove Favorites", "Add Favorites", "Cancel"])
    }
    (session: builder.Session, results: builder.IPromptChoiceResult, next: any) =>
    {
        if (results.response.index == 0) // remove favorites
        {
            session.beginDialog('/removeFavorites');
        }
        else if (results.response.index == 1) // add favorites
        {
            session.beginDialog('/addFavorites');
        }
        else // cancel
        {
            session.endDialog("Okay returning you to account settings home.")
        }
    }, 
    (session: builder.Session, result: builder.IDialogResult<any>, next: any) =>
    {
        // Create the entity 
        let newUser = 
        {
            PartitionKey: entGen.String(session.userData.phone),
            RowKey: entGen.String(session.userData.pin),
            Favorite_Locations: entGen.String(JSON.stringify(session.userData.favoriteLocations))
        }
        // Update the database
        tableService.mergeEntity("User", newUser, (error,results, response) => 
        {
            if (error)
            {
                console.log(error);
                session.send("There was an error when updating your acocunt.")
                session.replaceDialog('/edit');
            }
            else
            {
                console.log(results);
                session.send("Your account was successfully updated!");
                session.replaceDialog("/edit")
            }
        })
    }

])

*/