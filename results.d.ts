export declare namespace Results
{
    export interface IOptions
    {
        rideshare: IRideshare;
        transit: ITransit;
        //carshare: Carshare;
    }

    interface IRideshare
    {
        price: string;
        driverTime: string;
        totalDistance: string;
        totalTime: string;
        serviceProvider: string;
        serviceType: string;
        proudctId: string;
    }
    
    interface ICarshare
    {

    }

    interface ITransit
    {
        steps: string;
        mainInfo: string;
    }

}