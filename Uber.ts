export declare module Uber {

    export interface IUberProductPrices {
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

    export interface IUberPrices {
        prices: IUberProductPrices[];
    }

    export interface IProductsInfo {
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

    export interface IProducts {
        products: IProductsInfo[];
    }
}

