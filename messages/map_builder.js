var builder = require('botbuilder');

function map_image_route_builder(start_lat, start_long, end_lat, end_long) {
    var MainUrl = "https://maps.googleapis.com/maps/api/staticmap?";
    var Key = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";
    // Set the constants
    var Size = "&size=640x640";
    var Format = "&format=png";
    var MarkerStyleStart = "&markers=color:red|label:A|" + start_lat + "," + start_long;
    var MarkerStyleEnd = "&markers=color:red|label:B|" + end_lat + "," + end_long;
    var Path = "&path=color:blue|" + start_lat + "," + start_long + "|" + end_lat + "," + end_long;
    return (MainUrl + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key);
}
function map_image_location_builder(lat, long) {
    var MainUrl = "https://maps.googleapis.com/maps/api/staticmap?";
    var Key = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";
    // Set the constants
    var Size = "&size=640x640";
    var Format = "&format=png";
    var MarkerStyleStart = "&markers=color:red|label:A|" + lat + "," + long;
    return MainUrl + Size + Format + MarkerStyleStart + Key;
}
function map_card_builder(session, lat, long) {
    var message = new builder.Message(session)
        .attachmentLayout(builder.AttachmentLayout.list)
        .addAttachment(new builder.HeroCard(session)
        .images([new builder.CardImage(session)
            .url(map_image_location_builder(lat, long))]));
    return message;
}

module.exports.map_image_route_builder = map_image_route_builder
module.exports.map_image_location_builder = map_image_location_builder
module.exports.map_card_builder = map_card_builder