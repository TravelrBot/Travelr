import * as azure from 'azure-storage';

function TableSeed() 
{
    
    let tableService: azure.TableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');

    tableService.createTableIfNotExists("Rideshare", (error, result, response) => 
    {
        if (error)
        {   
            console.log("There was an error creating Rideshare table");
            console.log(error)
        }
        else
        {
            console.log(`The ${result.TableName} table creation is: ${result.isSuccessful}`)
        }
    });

    tableService.createTableIfNotExists("Carshare", (error, result, response) => 
    {
        if (error)
        {   
            console.log("There was an error creating Carshare table");
            console.log(error)
        }
        else
        {
            console.log(`The ${result.TableName} table creation is: ${result.isSuccessful}`)
        }
    });
}

/*
    tableService.insertEntity("CustomerInfo", person, (error, result, response) =>
    {
        if (!error)
        {   
            console.log("Person added to Table: ")
            console.log(response.isSuccessful);
        }
        else
        {
            console.log("There was an error: \n")
            console.log(error);
        }
    });



function Retrieve()
{
    let tableService: azure.TableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');

    let query = new azure.TableQuery()
        .top(5)
        .where('PartitionKey eq ?', "User");

    tableService.queryEntities('CustomerInfo', query, null, (error, result, response) => 
    {
        console.log(response.body);
        console.log(result.entries);
    }) 
}

*/


TableSeed();