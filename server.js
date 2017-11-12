/* eslint-env node */

// Express app
//var _ = require('lodash');
const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
//const cors = require('cors');
const favicon = require('serve-favicon');
const fetch = require('node-fetch');
const querystring = require('querystring');
const conllu = require('conllu');
const franc = require('franc-min');
const gtr = require('google-translate-api');
const wiki = require('wikijs').default;
const PythonShell = require('python-shell');


// Static assets to be served:
app.use(express.static(path.join(__dirname,'public')));
app.use(favicon(path.join(__dirname,'public/img','favicon-edit.ico')));

// Set up middleware:
app.use(bodyParser.urlencoded({ extended: false }));	// parse application/x-www-form-urlencoded
app.use(bodyParser.json()); 	// for parsing application/json
//app.use(cors());				// might need configuring, specific domains etc.


// SERVICES:
// Local franc module will detect any text's language:
function detectLang(text) {
	var topMatch = franc(text);

	// Conversion from franc's code to UDPipe model name & iso code:
	var languageCodes = {
		'eng': ['english','en'],
		'spa': ['spanish','es'],
		'fra': ['french','fr'],
		'por': ['portuguese','pt'],
		'ita': ['italian','it'],
		'rus': ['russian','ru'],
		'deu': ['german','de'],
		'nob': ['norwegian','nb'],
		'swe': ['swedish','sv'],
		'nld': ['dutch','nl'],
		'dan': ['danish','da'],
		'ell': ['greek','el'],
		'cat': ['catalan','ca'],
		'ron': ['romanian','ro'],
		'unk': ['unknown', 'en']
	};
	console.log(languageCodes[topMatch][0], 'detected');
	return {
		modelName: languageCodes[topMatch][0],
		isoCode: languageCodes[topMatch][1]
	};
}

// Make a request to the UDPipe API to tokenise, lemmatise and tag our string:
function udpipe(input, langModelName) {
	const baseUrl = "http://lindat.mff.cuni.cz/services/udpipe/api";
	var opts = {
		data: input,
		model: langModelName,
		tokenizer: '',
		tagger: '',
		parser: ''
	};

	var url = baseUrl + '/process?' + querystring.stringify(opts);
	console.log(url);
	var fetched = fetch(url);
	return fetched;
}

// Generate HTML to send back to page:
function renderHTML(conlluObj, lang) {
	var html = "";
	for (var i = 0; i < conlluObj.sentences.length; i++) {
		var s = conlluObj.sentences[i];
		if (s.tokens.length < 1) break;	// fix for empty trailing sentence

		for (var j = 0; j < s.tokens.length; j++) {
			var token = s.tokens[j];
			//console.log(token);
			token.en = Promise.resolve(translateByGoogle(token.form));
			// Build the token's HTML tag:
			if (['PUNCT', 'NUM'].includes(token.upostag)) {
				html += token.form;
			}
			else {
				var classes = [token.upostag, token.xpostag];
				if (token.feats) {
					if (token.feats.includes("Gender=Fem")) classes.push("fem");
					else if (token.feats.includes("Gender=Masc")) classes.push("masc");
					else if (token.feats.includes("Gender=Neut")) classes.push("neuter");
					else if (token.feats.includes("Gender=Com")) classes.push("common");
					if (token.feats.includes("Case=Nom")) classes.push("nominative");
					else if (token.feats.includes("Case=Acc")) classes.push("accusative");
					else if (token.feats.includes("Case=Gen")) classes.push("genitive");
					else if (token.feats.includes("Case=Dat")) classes.push("dative");
					else if (token.feats.includes("Case=Instr")) classes.push("instrumental");
					else if (token.feats.includes("Case=Prep")) classes.push("prepositional");
				}
				html += `<ruby class="${classes.join(" ")}" id="${lang.isoCode}_${token.form}">
							<rb title="${tokenTooltip(token)}">${token.form}</rb>
							<rt>${token.en}</rt>
							<rt></rt>
						</ruby>`;
			}
			// Space after by default:
			if (!token.misc || token.misc !== 'SpaceAfter=No') html += " ";
		}
		// When should newline be applied?
		//html += "<br>";
	}
	return html;
}

// Generate token's tooltip content:
function tokenTooltip(token) {
	token.en = '?';//Promise.resolve(translateByGoogle(token.form));
	return `${token.en} <br> ${token.lemma} | ${token.upostag} <br> ${token.feats}`;
}

// GTranslate a string:
function translateByGoogle(input, toLang) {
	return gtr(input, {to: 'en'}).then(res => {
		return res.text;
	}).catch(err => {
		console.error(err);
	});
}

// Fetch a verb conjugation:
function fetchVerbConj(verb, lang) {
	return verb;
}

// Wrapper for Python wordfreqs script:
function getWordFreqs(words, lang) {
	var options = {
		mode: 'text',
		pythonPath: 'python',
		pythonOptions: ['-u'],
		scriptPath: '',
		args: words.concat(lang)
	};

	PythonShell.run('wordfreqs.py', options, function(err, results) {
		if (err) throw err;
		// results is an array consisting of messages collected during execution
		console.log('wordfreqs.py results: %j', results);

		var freqDict = {};
		for (var pair of results) {
			var [word, score] = pair.split(" ");
			freqDict[word] = score;
		}
		console.log(freqDict);

		io.emit('freqs', freqDict);
	});
}
//getWordFreqs(['big','red','helicopter'], 'en');


// ROUTES:
// Serve index.html & accoutrements:
app.get('/', function(req, res) {
	console.log("Express serving index.html");	// DOES NOT RUN
	//res.render('/index.html');
	res.sendFile(path.join(__dirname + '/public/index.html'));
});

// Serve random Wikipedia texts:
app.get('/wikipedia/:lang/:num', function(req, res) {
	console.log("Request received:", req.params);
	var {lang, num} = req.params;
	// Set up language-specific wiki fetcher:
	var wp = wiki({ apiUrl: 'http://'+lang+'.wikipedia.org/w/api.php' });
	// Get random titles:
	while (num > 0) {
		wp.random().then(randTitle => {
			console.log(randTitle);	// ok
			// Get content from titles:
			wp.page(randTitle)
				.then(page => page.content())
				.then(content => content.substring(0,300))
				.then(text => {
					console.log(text);
					io.emit('wiki', {'lang': lang, 'text': text});
				});
		})
		.catch(err => console.log(200, err));
		num--;
	}
});

// Language detection:
app.post('/detect', function(req, res) {
	console.log('Got a POST request at /detect');
	var lang = detectLang(req.body.data);
	//res.send(lang.modelName);
	io.emit('lang', lang);
});

// Frequency getter:
app.post('/frequencies', function(req, res) {
	console.log('Got a POST request at /frequencies');
	var lang = detectLang(req.body.data);

	// Perform frequencies lookup:
	var wordlist = req.body.data.split(/\W/)
		.reduce(t => t.length > 2);
	console.log(220, wordlist);
	getWordFreqs(wordlist, lang.isoCode);
});

// Process source text:
app.post('/process', function(req, res) {
	console.log('Got a POST request at /process:', req.body);
	// Detect lang alwaus:
	var lang = detectLang(req.body.data);
	// Send request to UDPipe API:
	var udPromise = udpipe(req.body.data, lang.modelName);
	// Handle API response:
	udPromise
		.then(udResponse => udResponse.json())
		.then(json => {
			// We have the tagged sentence(s) but in a nasty format
			var udResult = json.result;
			console.log(udResult);
			// Instantiate a ConLLU interpreter:
			var conObj = new conllu.Conllu();
			conObj.serial = udResult;	// HOW TO USE CONLLU MODULE WITH RESPONSE??
			//console.log(c);
			var html = renderHTML(conObj, lang);
			res.send(html);
		})
		.catch(err => res.end(err));
});

// Translate source text:
app.post('/translate', function(req, res) {
	console.log('Got a POST request at /translate:', req.body);
	Promise.resolve(translateByGoogle(req.body.data))
		.then(translation => res.send(translation));
});

// Fallback 404:
app.use(function(req, res) {
	console.log("404 served");
	res.status(404).send("Sorry can't find that!");
});


// SOCKET.IO SETUP
io.on('connection', function(socket) {
	console.log('a user connected');
	socket.on('disconnect', function() {
		console.log('user disconnected');
	});
});


// Serve:
var port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Magic happens on port ' + port);
});
