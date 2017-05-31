export declare module Lyft
{
    interface IRidePricing {
        base_charge: number;
        cost_per_mile: number;
        cost_per_minute: number;
        cost_minimum: number;
        trust_and_service: number;
        currency: string;
        cancel_penalty_amount: number;
    }

    interface IRideTypeInfo {
        display_name: string;
        ride_type: string;
        image_url: string;
        pricing_details: IRidePricing;
        seats: number;
    }

    interface IAllRideTypes {
        ride_types: IRideTypeInfo[];
    }

    interface ISelectedRideTypes
    {
        ride_type: string;
        display_name: string;
    }

    interface IRideEstimate {
        ride_type: string;
        estimated_duration_seconds: number;
        estimated_distance_miles: number;
        estimated_cost_cents_max: number;
        primetime_percentage: string;
        currency: string;
        estimated_cost_cents_min: number;
        display_name: string;
        primetime_confirmation_token?: any;
        cost_token?: any;
        is_valid_estimate: boolean;
    }

    interface IAllEstimates {
        cost_estimates: IRideEstimate[];
    }

    interface DriverEta {
        display_name: string;
        ride_type: string;
        eta_seconds: number;
        is_valid_estimate: boolean;
    }

    interface AllEtas {
        eta_estimates: DriverEta[];
    }

    interface IBestLyftOption
    {
        ride_type: string;
        estimated_duration_seconds: number;
        estimated_distance_miles: number;
        price: number;
        primetime_percentage: string;
        display_name: string;
        driver_time: number;
    }
}