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
}