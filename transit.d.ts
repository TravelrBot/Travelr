export declare namespace Transit {

    export interface IGeocodedWaypoint {
        geocoder_status: string;
        place_id: string;
        types: string[];
    }

    export interface INortheast {
        lat: number;
        lng: number;
    }

    export interface ISouthwest {
        lat: number;
        lng: number;
    }

    export interface IBounds {
        northeast: INortheast;
        southwest: ISouthwest;
    }

    export interface IArrivalTime {
        text: string;
        time_zone: string;
        value: number;
    }

    export interface IDepartureTime {
        text: string;
        time_zone: string;
        value: number;
    }

    export interface IDistance {
        text: string;
        value: number;
    }

    export interface IDuration {
        text: string;
        value: number;
    }

    export interface IEndLocation {
        lat: number;
        lng: number;
    }

    export interface IStartLocation {
        lat: number;
        lng: number;
    }


    export interface IPolyline {
        points: string;
    }


    export interface IStep2 {
        distance: IDistance;
        duration: IDuration;
        end_location: IEndLocation;
        html_instructions: string;
        polyline: IPolyline;
        start_location: IStartLocation;
        travel_mode: string;
        maneuver: string;
    }

    export interface ILocation {
        lat: number;
        lng: number;
    }

    export interface IArrivalStop {
        location: ILocation;
        name: string;
    }

    export interface IArrivalTime2 {
        text: string;
        time_zone: string;
        value: number;
    }

    export interface ILocation2 {
        lat: number;
        lng: number;
    }

    export interface IDepartureStop {
        location: ILocation2;
        name: string;
    }

    export interface IDepartureTime2 {
        text: string;
        time_zone: string;
        value: number;
    }

    export interface IAgency {
        name: string;
        url: string;
    }

    export interface IVehicle {
        icon: string;
        name: string;
        type: string;
    }

    export interface ILine {
        agencies: IAgency[];
        color: string;
        name: string;
        short_name: string;
        text_color: string;
        vehicle: IVehicle;
    }

    export interface ITransitDetails {
        arrival_stop: IArrivalStop;
        arrival_time: IArrivalTime2;
        departure_stop: IDepartureStop;
        departure_time: IDepartureTime2;
        headsign: string;
        line: ILine;
        num_stops: number;
    }

    export interface IStep {
        distance: IDistance;
        duration: IDuration;
        end_location: IEndLocation;
        html_instructions: string;
        polyline: IPolyline;
        start_location: IStartLocation;
        steps: IStep2[];
        travel_mode: string;
        transit_details: ITransitDetails;
    }

    export interface ILeg {
        arrival_time: IArrivalTime;
        departure_time: IDepartureTime;
        distance: IDistance;
        duration: IDuration;
        end_address: string;
        end_location: IEndLocation;
        start_address: string;
        start_location: IStartLocation;
        steps: IStep[];
        traffic_speed_entry: any[];
        via_waypoint: any[];
    }

    export interface IOverviewPolyline {
        points: string;
    }

    export interface IRoute {
        bounds: IBounds;
        copyrights: string;
        legs: ILeg[];
        overview_polyline: IOverviewPolyline;
        summary: string;
        warnings: string[];
        waypoint_order: any[];
    }

    export interface IAllTransitInfo {
        geocoded_waypoints: IGeocodedWaypoint[];
        routes: IRoute[];
        status: string;
    }

}

