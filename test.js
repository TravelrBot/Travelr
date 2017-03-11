var request = require('request');
function trace ()
    {
        var access_token; 

        client_token = 'gAAAAABYw0rkJ3ukCF7xG_88XPPRK0fguyi2Ub2RF2gOnwcY7z8bQYflrhwkh24c3OsHAfBtH0Xbb8r-VQxmk8y01BBl-SymiBE8Lz0wlkG5Sa2VdQUo86AP1ncyRpGKQ_rYc66jfExJ_m1bpEaotykPMVNZzrObZ0JVEBdPRbDhZ4dXLbIQ_l4='
        client_secret = '9Jz-WN7J3dMoVFcMhw9wGtVcDg1fK1gV'

        var headers = {
            'Content-Type': 'application/json'
        };

        var dataString = '{"grant_type": "client_credentials", "scope": "public"}';
        
        var options = {
            url: 'https://api.lyft.com/oauth/token',
            method: 'POST',
            headers: headers,
            body: dataString,
            auth: {
                'user': '9LHHn1wknlgs',
                'pass': '9Jz-WN7J3dMoVFcMhw9wGtVcDg1fK1gV'
            }
        };

        request(options, function(err, obj, res){
            if (err){
                console.log(err);
            }

            else{

                // get the access token 
                var parsed = JSON.parse(res);
                var access_token = parsed.access_token;
                console.log(res);
                console.log(access_token);

                var headers = {
                     'Authorization': 'bearer ' + access_token
                };

                var url_lyft = 'https://api.lyft.com/v1/cost?start_lat=' + 
                    sessiion.userData.start_lat + '&start_lng=' + 
                    session.userData.start_long + '&end_lat=' +
                    session.userData.end_lat + '&end_lng=' +
                    session.userData.end_long;


                // create the get request 
                var options = {
                    url: url_lyft,
                    method: "GET",
                    headers: headers,
                };

                request(options, function(err, obj, res)
                {
                    if (err)
                    {
                        console.log(err);
                    }

                    else
                    {
                        // parse the json 
                        var lyft_pared = JSON.parse(res);
                        console.log(lyft_pared);
                    }
                })
            }

        });

    }

trace();
