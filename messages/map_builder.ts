import * as builder from "botbuilder";

export function map_image_route_builder(start_lat: number| null, start_long: number | null, end_lat: number | null, end_long: number | null): string
{
    
    let MainUrl: string = "https://maps.googleapis.com/maps/api/staticmap?";

    let Key: string = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";

    // Set the constants
    let Size: string = "&size=640x640";

    let Format: string = "&format=png";

    let MarkerStyleStart: string = "&markers=color:red|label:A|" + start_lat + "," + start_long;  

    let MarkerStyleEnd: string = "&markers=color:red|label:B|" + end_lat + "," + end_long; 

    let Path: string = "&path=color:blue|" + start_lat + "," + start_long + "|" + end_lat + "," + end_long;

    return (MainUrl + Size + Format + MarkerStyleStart + MarkerStyleEnd + Path + Key);

}

export function map_image_location_builder(lat: number, long: number): string
{
    let MainUrl: string = "https://maps.googleapis.com/maps/api/staticmap?";

    let Key: string = "&key=AIzaSyDQmIfhoqmGszLRkinJi7mD7SEWt2bQFv8";

    // Set the constants
    let Size: string = "&size=640x640";

    let Format: string = "&format=png";

    let MarkerStyleStart: string = "&markers=color:red|label:A|" + lat + "," + long;  

    return MainUrl + Size + Format + MarkerStyleStart + Key;
}

export function map_card_builder(session: builder.Session, lat: number, long: number): builder.Message
{
    let message: builder.Message = new builder.Message(session)
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .addAttachment(new builder.HeroCard(session)
            .images([new builder.CardImage(session)
                .url(map_image_location_builder(lat, long))]))

    return message; 
}

