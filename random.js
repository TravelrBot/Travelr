function LocationAddressFomater(address) {
    'pickup[formatted_address]=DFW%20Airport%2C%20Grapevine%2C%20TX%2C%20United%20States';
    var addressSplit = address.split(" ");
    var formattedAddress = '';
    for (var index = 0; index < addressSplit.length; index++) {
        formattedAddress += (addressSplit[index]);
        if (index < addressSplit.length - 1) {
            formattedAddress += '%20';
        }
        else {
            // add nothing 
            continue;
        }
    }
    return formattedAddress;
}
var t = LocationAddressFomater("The cat in the hat");
console.log(t);
