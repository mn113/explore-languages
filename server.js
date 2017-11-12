/* eslint-env node */

// Express app
//var _ = require('lodash');
const path = require('path');
const express = require('express');
const app = express();
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
app.use(favicon(path.join(__dirname,'public/img','favicon-edit.ico')));
app.use(express.static(path.join(__dirname,'public')));

// Set up middleware:
app.use(bodyParser.urlencoded({ extended: false }));	// parse application/x-www-form-urlencoded
app.use(bodyParser.json()); 	// for parsing application/json
//app.use(cors());				// might need configuring, specific domains etc.


// SERVICES:
// Local franc module will detect any text's language:
function detectLang(text) {
	var topMatch = franc(text);
	console.log(text, topMatch);
	//return (topMatch[1] > 0.8) ? topMatch[0] : 'english';
	return topMatch;
}

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

// Generate HTML to send back to page:
function renderHTML(conlluObj, lang) {
	var html = "";
	for (var i = 0; i < conlluObj.sentences.length; i++) {
		var s = conlluObj.sentences[i];
		console.log('sentence', i);

		// Perform frequencies lookup:
		console.log(s.tokens.length, 'tokens...');
		console.log(s.tokens[0]);
		var wordlist = s.tokens.reduce(t => t.upostag !== 'PUNCT').map(t => t.form);	// ERROR
		console.log(wordlist, lang);
		var freqs = getWordFreqs(wordlist[0], wordlist[1], wordlist[2], lang);
		console.log(freqs);

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
				html += `<ruby class="${classes.join(" ")}">
				<rb title="${tokenTooltip(token)}">${token.form}</rb>
				<rt>${token.en}</rt>
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
		console.log('results: %j', results);
	});
}
//var tw = ['big', 'red', 'helicopter'];
//getWordFreqs(tw, 'en');


// ROUTES:
// Serve index.html & accoutrements:
app.get('/', function(req, res) {
	console.log("Express serving index.html");	// DOES NOT RUN
	//res.render('/index.html');
	res.sendFile(path.join(__dirname + '/public/index.html'));
});

// Serve Wikipedia texts:
app.get('/wikipedia/:lang/:num', function(req, res) {
	console.log("Request received:", req.params);
	// Set up language-specific wiki fetcher:
	var wp = wiki({ apiUrl: 'http://'+req.params.lang+'.wikipedia.org/w/api.php' });
	// Get random titles:
	wp.random(req.params.num).then(randomTitles => {
		console.log(randomTitles);
		// Get content from titles:
		var contents = randomTitles.map(title => {
			var content = wp.page(title).then(page => page.content());
			return content;
		});
		return Promise.all(contents);
	})
	.then(console.log)	// OK
	.then(res.send)		// ERROR COMES UP HERE?
	.catch(err => console.log(157, err));
});

// Language detection:
app.post('/detect', function(req, res) {
	res.send(detectLang(req.body.data));
});

// Process source text:
app.post('/process', function(req, res) {
	console.log('Got a POST request at /process:', req.body);
	// Detect lang alwaus:
	var lang = detectLang(req.body.data);
	// Send request to UDPipe API:
	var udPromise = udpipe(req.body.data, lang);
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

// Fallback:
app.use(function(req, res) {
	console.log("404 served");
	res.status(404).send("Sorry can't find that!");
});


// Serve:
var port = process.env.PORT || 3000;
app.listen(port);
console.log('Magic happens on port ' + port);
