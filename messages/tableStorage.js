var azure = require('azure-storage');

function TableSeed() {
    var time = Date.now();
    var now = time.toString();
    var tableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
    tableService.createTableIfNotExists("CustomerInfo", function (error, result, response) {
        if (!error)
        {
            console.log("Finished table\n");
            console.log("Table " + result.TableName + "'s creation was successful: " + result.created + "\n");
            var entGen = azure.TableUtilities.entityGenerator;
            var Uber =  {
                    ride: "Lyft",
                    price: 55,
                    distance: 5
                };
            var uberString = JSON.stringify(Uber);
            var person = {
                PartitionKey: entGen.String('User'),
                RowKey: entGen.String(now),
                Lyft: entGen.String(uberString)
            };
            tableService.insertEntity("CustomerInfo", person, function (error, result, response) 
            {
                if (!error) {
                    console.log("Person added to Table: ");
                    console.log(response.isSuccessful);
                    Retrieve(uberString);
                }
                else {
                    console.log("There was an error adding the person: \n\n");
                    console.log(error);
                }
                

            });
        }
        else
        {
            console.log("There was an error creating the table: \n\n")
            console.log(error)
        }
        
    });
}

function Retrieve(string) {
    var tableService = azure.createTableService('DefaultEndpointsProtocol=https;AccountName=travelrbotc4g2ai;AccountKey=cL2Xq/C6MW2ihDet27iU8440FFj1KU0K0TIo1QnYJ3gvyWQ4cn6LysyZInjE0jdeTW75zBTAgTbmkDriNlky0g==;EndpointSuffix=core.windows.net');
    var query = new azure.TableQuery()
    tableService.queryEntities('CustomerInfo', query, null, function (error, result, response) {

        for (var index = 0; index < result.entries.length; index++) {
            var element = result.entries[index];

            if (element.Lyft)
            {
                var data = JSON.parse(element.Lyft._)
                console.log(data);
                console.log(data.price);
            }
            
        }
    });
}


