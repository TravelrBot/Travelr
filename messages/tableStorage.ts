import * as azure from 'azure-storage';


async function TableSeed() 
{
    let tableService: azure.TableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');

    await tableService.createTable("CustomerInfo", (error, result, response) => 
    {
        console.log(`Table ${result.TableName}'s creation was successful: ${result.created}`);
    });

    let entGen = azure.TableUtilities.entityGenerator;

    let person = 
    {
        PartitionKey: entGen.String('User'),
        RowKey: entGen.String('1'),
        Uber: 
        {
            ride: "Uberx",
            price: 22,
            distance: 5
        }
    }

    await tableService.insertEntity("CustomerInfo", person, (error, result, response) =>
    {
        if (!error)
        {
            console.log(response.isSuccessful);
        }
    })

    console.log("Finished table");
}

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