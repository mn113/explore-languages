/* eslint-env node */

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
const conllu = require('conllu');
const franc = require('franc-min');


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
	// Conversion from franc's code to UDPipe model name:
	var languageCodes = {
		'eng': 'english',
		'spa': 'spanish',
		'fra': 'french',
		'por': 'portuguese',
		'ita': 'italian',
		'rus': 'russian',
		'deu': 'german',
		'nob': 'norwegian',
		'swe': 'swedish',
		'nld': 'dutch',
		'dan': 'danish',
		'ell': 'greek',
		'cat': 'catalan'
	};

	const baseUrl = "http://lindat.mff.cuni.cz/services/udpipe/api";
	var opts = {
		model : languageCodes[lang],
		tokenizer: '',
		tagger: '',
		parser: '',
		data: input
	};

	var url = baseUrl + '/process?' + querystring.stringify(opts);
	console.log(url);
	var fetched = fetch(url);
	return fetched;
}


function detectLang(text) {
	var topMatch = franc(text);
	console.log(text, topMatch);
	//return (topMatch[1] > 0.8) ? topMatch[0] : 'english';
	return topMatch;
}

// ROUTES:
// Serve static game page:
app.get('/', function(req, res) {
	console.log("Express serving index.html");	// NOT RUN
	//res.render('/index.html');
	res.sendFile(path.join(__dirname + '/public/index.html'));
});

// Process source text:
app.post('/process', function(req, res) {
	console.log('Got a POST request at /process:', req.body);
	var lang = detectLang(req.body.data);
	var udPromise = udpipe(req.body.data, lang);

	udPromise.then(udResponse => udResponse.text())
			.then(json => {
				// We have the tagged sentence(s) but in a nasty format
				console.log(json);
				// Instantiate a ConLLU interpreter:
				var c = new conllu.Conllu();
				//c.serial(json.result);
				console.log(c);
				res.end(json.result);
			})
			.catch(err => res.end(err));
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
