function trace(cat) 
{
    try 
    {
        var dog = cat / 2;
        console.log(dog);
    } 
    catch (error) 
    {
        console.log(error);
    }

    console.log("Trace is cool");

}

trace("monkey");