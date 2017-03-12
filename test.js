function trace() 
{
    var string = 'hello world <b> my name is </b><didid> trace <jfjfjf> tschida <jdjdjd> ';

    var string_array = string.split("");
    
    var empty = '';

    console.log(empty);

    for (var i = 0; i < string_array.length; i+= 1)
    {
        if (string_array[i] == "<")
        {

           while (string_array[i] != ">" || string_array[i+1] == "<" )
            {
                i+= 1;
            } 

            i++;
        }

        empty += string_array[i];   
    }

    console.log(empty.replace(/  /g, " ").trim());
    
}

trace();