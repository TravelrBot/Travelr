import * as request from 'request';
'https://maps.googleapis.com/maps/api/geocode/json?latlng=40.714224,-73.961452&key=YOUR_API_KEY';

let start_lat: number = 40.714224;
let start_long: number = -73.961452;
let key: string = 'AIzaSyDdt5T24u8aTQG7H2gOIQBgcbz00qMcJc4';
let result_type_1: string = 'administrative_area_level_1';
let result_type_2: string = 'administrative_area_level_2';
let result_type_3: string = 'administrative_area_level_3';


let car2go_location_url: string = 'http://www.car2go.com/api/v2.1/locations';

