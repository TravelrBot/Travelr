var request = require("request");

var MainUrl = "https://maps.googleapis.com/maps/api/staticmap?";

var Key = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";

var Zoom = "zoom=15";

var Size = "&size=640x640";

var Format = "&format=gif";

var MarkerStyleStart = "&markers=color:red|label:A|" + session.userData.start_lat + "," + session.userData.start_long;  

var MarkerStyleEnd = "&markers=color:red|label:B|" + session.userData.end_lat + "," + session.userData.end_long; 

var Path = "&path=color:blue|" + session.userData.start_lat + "," + session.userData.start_long + "|" + session.userData.end_lat + "," + session.userData.end_long;

var Query = MainUrl + Zoom + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key; 

var Call = 
{
    url: Query,
    method: "GET"
};

console.log(Query);

// Call the request 
request(Call, function(error, object, response)
{
    if (error)
    {
        console.log(error);
    }
    else
    {
        console.log("Picture");
    }
});