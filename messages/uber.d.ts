export declare module Uber {
    interface IUberProductPrices {
        localized_display_name: string;
        distance: number;
        display_name: string;
        product_id: string;
        high_estimate: number;
        low_estimate: number;
        duration: number;
        estimate: string;
        currency_code: string;
    }
    interface IUberPrices {
        prices: IUberProductPrices[];
    }
    interface IProductsInfo {
        upfront_fare_enabled: boolean;
        capacity: number;
        product_id: string;
        image: string;
        cash_enabled: boolean;
        shared: boolean;
        short_description: string;
        display_name: string;
        product_group: string;
        description: string;
    }
    interface IProducts {
        products: IProductsInfo[];
    }
    interface ISelectedRides {
        display_name: string;
    }
    interface IBestOption {
        uber_name: string;
        uber_price: number;
        uber_travel_time: number;
        uber_distance: number;
        uber_driver_time: any;
        uber_productId: string;
    }
    interface DriverTimeInfo {
        localized_display_name: string;
        estimate: number;
        display_name: string;
        product_id: string;
    }
    interface DriverTime {
        times: DriverTimeInfo[];
    }
}
