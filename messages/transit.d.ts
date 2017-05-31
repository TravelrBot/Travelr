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


    export interface IDepartureStop {
        location: ILocation;
        name: string;
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
        arrival_time: IArrivalTime;
        departure_stop: IDepartureStop;
        departure_time: IDepartureTime;
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

    export interface IFinalLegInfo
    {
        transitArrivalTime: string;
        transitDepartureTime: string;
        transitDuration: string;
        transitDistance: string;
        transitSteps: IStepInfo[];
    }

    export interface IStepInfo
    {
        stepDistance: string;
        stepDuration: string;
        stepTransitMode: string;
        stepMainInstruction: string;
    }

    export interface IStepDetailedWalkingInfo
    {
        stepDistance: string;
        stepDuration: string;
        stepMainInstruction: string;
        stepTransitMode: string;
    }


    export interface IStepWalkingInfo extends IStepInfo
    {   
        stepDeatiledInstructions: IStepDetailedWalkingInfo[];    
    }

    export interface IStepTransitInfo extends IStepInfo
    {
        arrivalStopName: string;
        arrivalStopTime: string;
        departureStopName: string;
        departureStopTime: string;
        numberOfStop: number;
        vehicleType: string;
        vehicleName: string;
    }

    export enum TransitOptions {WALKING, TRANSIT}

}

