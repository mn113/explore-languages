/* */

// Express app
//var _ = require('lodash');
var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors');
//var geoip = require('geoip-lite');
var favicon = require('serve-favicon');
const fetch = require('node-fetch');
const querystring = require('querystring');

// Static assets to be served:
app.use(favicon(path.join(__dirname,'public/img','favicon-edit.ico')));
app.use(express.static(path.join(__dirname,'public')));

// Set up middleware:
app.use(bodyParser.urlencoded({ extended: false }));	// parse application/x-www-form-urlencoded
app.use(bodyParser.json()); 	// for parsing application/json
app.use(cors());				// might need configuring, specific domains etc.


// SERVICES:
// Make a request to the UDPipe API to tokenise, lemmatise and tag our string:
function udpipe(input, lang) {
	const baseUrl = "http://lindat.mff.cuni.cz/services/udpipe/api/process";
	var opts = {
		model : lang,
		tokenizer: '',
		tagger: '',
		parser: '',
		data: input
	};

	var fetched = fetch(baseUrl + querystring.stringify(opts));
	return fetched;
}


// ROUTES:
// Serve static game page:
app.get('/', function(req, res) {
	console.log("Express serving index.html");	// NOT RUN
	//res.render('/index.html');
	res.sendFile(path.join(__dirname + '/public/index.html'));
});

// Process source text:
app.put('/process', function(req, res) {
	console.log('Got a PUT request at /process');
	console.log(req);
	var output = udpipe(req, 'spanish');
	console.log(output);

	// Text for the requester:
	output.then(response => response.text())
			.then(text => res.end(text))
			.catch(err => res.end(err));

	//res.status(200).json(output);
});

// Fallback:
app.use(function(req, res) {
	console.log("404 served");
	res.status(404).send("Sorry can't find that!");
});


// Serve:
const port = 3000;
app.listen(port);
console.log('Magic happens on port ' + port);
