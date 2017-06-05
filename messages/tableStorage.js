var azure = require('azure-storage');
function Retrieve() 
{
    var tableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');

    var entGen = azure.TableUtilities.entityGenerator;

    var query = new azure.TableQuery()
        .select(['RowKey'])
        .where("RowKey lt '" + Number.MAX_SAFE_INTEGER + "'")
        .top(2);
    tableService.queryEntities("CustomerInfo", query, null, (error, result, resposne) => 
    {
        if (error)
        {
            console.log(error);
        }
        else
        {
            result.entries.reverse();
            for (var i = 0; i < result.entries.length; i++)
            {
                console.log(result.entries[i].RowKey._)
            }
        }
    })
}

Retrieve();


