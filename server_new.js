process.stdin.setEncoding("utf8");

let https = require("https");
let path = require("path");
let express = require("express");
let bodyParser = require("body-parser");

const app = express();
const args = process.argv;
app.set("views", path.resolve(__dirname, "templates"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
const port = process.argv[2] || 3000;
const server = https.createServer(app);

// MongoDB
require("dotenv").config({ path: path.resolve(__dirname, 'mongodb_credentials/.env') })
const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseAndCollection = { db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION };
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${userName}:${password}@cluster0.lflawry.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


let collection;
let nbaLogoMap;

try {
    client.connect().then(() => {
            //console.log('Connected to MongoDB');
            collection = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);
        })
        .catch((error) => {
            console.error('Failed to connect to MongoDB:', error);
            process.exit(1);
        });
} catch (err) {
    console.error("Error inserting document:", err);
} finally {
    client.close();
}

// NBA API Configuration
const options = {
    method: 'GET',
    hostname: 'api-nba-v1.p.rapidapi.com',
    port: null,
    path: '/teams',
    headers: {
        'X-RapidAPI-Key': 'ba3ac1a2e2mshe6ebc5b1385e3a0p1325dajsn8228d5c4169f',
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com'
    }
};


// Retrieve data from NBA API
const req = https.request(options, function(response) {
    let body = '';

    response.on('data', function(chunk) {
        body += chunk;
    });

    response.on('end', function() {
        let jsonData;
        try {
            jsonData = JSON.parse(body);
        } catch (error) {
            console.error('Failed to parse JSON data:', error);
            return;
        }
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

        const allTeams = dataArray.map(data => data.response);

        const nbaTeams = allTeams.flat().filter(obj => obj.nbaFranchise);

        global.nbaLogoMap = nbaTeams.map(({ name, logo }) => ({
            [name]: logo
        }));
    });
});

req.end();

async function addProfile(name, age, favTeam, aboutSelf){
    try
    {
        await client.connect();
        let profile = {name: name, age: age, favTeam: favTeam, aboutSelf: aboutSelf};
        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(profile);
    }
    catch (e)
    {
        console.error(e);
    }
    finally
    {
        await client.close();
    }
}

async function searchProfile(name){

    try
    {
        await client.connect();
        return await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).findOne({name: name});
    }
    catch (e)
    {
        console.error(e);
    }
    finally
    {
        await client.close();
    }
}

async function findFans(team){
    try
    {
        await client.connect();
        let fanList = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).find({favTeam: {$eq: team}});
        fanList = await fanList.toArray();
        const names = fanList.map((fan) => fan.name);
        names.toString();
        return names;
    }
    catch (e)
    {
        console.error(e);
    }
    finally
    {
        await client.close();
    }
}

app.get("/", (request, response) =>
{
    response.render("home");
});

app.get("/createProfile", (request, response) =>
{
    response.render("createProfile");
});

app.post("/createProfile", async (request, response) =>
{
    // let team = request.body.favTeam;
    // let logo = nbaLogoMap.team;
    let variables =
    {
        name: request.body.name,
        age: request.body.age,
        favTeam: request.body.favTeam,
        aboutSelf: request.body.aboutSelf
        // logo: nbaLogoMap.request.body.favTeam
    };
    console.log(variables.logo)
    try 
    {
        await addProfile(variables.name, variables.age, variables.favTeam, variables.aboutSelf);
    } 
    catch (e)
    {
        console.log("ERROR: " + e);
    }

    response.render("createProfileConfirm", variables);
});

app.get("/viewProfile", (request, response) =>
{
    response.render("viewProfile");
});

app.post("/viewProfile", async (request, response) =>
{
    let variables;
    try 
    {
        let output = await searchProfile(request.body.name);
        variables =
        {
            name: output.name,
            age: output.age,
            favTeam: output.favTeam,
            aboutSelf: output.aboutSelf
        };
    } 
    catch (e)
    {
        console.log("ERROR: " + e);
    }

    response.render("showProfile", variables);
});

app.get("/findFans", (request, response) =>
{

    response.render("findFans");
});

app.post("/findFans", async (request, response) =>
{
    let variables;

    try 
    {
        let output = await findFans(request.body.team);

        variables =
        {
            team: request.body.team,
            fanList: output,
        };
    } 
    catch (e)
    {
        console.log("ERROR: " + e);
    }

    response.render("showFans", variables);
});

app.listen(port, () => {
    console.log(`Web server is running at http://localhost:${port}`);
    console.log(`Type stop to shutdown the server:`);
});

process.stdin.on('data', (data) => {
    if (data !== null) {
        let cmd = data.toString().trim();
        if (cmd === 'stop') {
            console.log('Shutting down the server');
            client.close(); // Close the MongoDB connection before exiting
            process.exit(0);
        } else {
            console.log('Invalid command: ' + cmd);
        }
        process.stdout.write("Type stop to shutdown the server:");
        process.stdin.resume();
    }
});