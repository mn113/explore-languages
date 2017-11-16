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
const striptags = require('striptags');
var console = require('better-console');


// Static assets to be served:
app.use(express.static(path.join(__dirname,'public')));
app.use(favicon(path.join(__dirname,'public/img','favicon-edit.ico')));

// Set up middleware:
app.use(bodyParser.urlencoded({ extended: false }));	// parse application/x-www-form-urlencoded
app.use(bodyParser.json()); 	// for parsing application/json
//app.use(cors());				// might need configuring, specific domains etc.


// REDIS:
var redis = require('redis');
var redisClient = redis.createClient({host: 'localhost', port: 6379});
// Test set/get:
redisClient.on("connect", function () {
	redisClient.set("foo_rand000000000000", "set/get works", redis.print);
	redisClient.get("foo_rand000000000000", redis.print);
	redisClient.exists("foo_rand000000000000", redis.print);
});
redisClient.on('ready', function() {
	console.info("Redis is ready");
});
redisClient.on('error', function() {
	console.error("Error in Redis");
});
redisClient.on('warning', function() {
	console.error("Redis Warning");
});

// Short & sweet hash maker:
String.prototype.hashCode = function() {
	var hash = 0;
	if (this.length === 0) return hash;
	for (var i = 0; i < this.length; i++) {
		var char = this.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
};

// Generate HTML to send back to page:
function renderHTML(conlluObj, lang) {
	var html = "";
	for (var i = 0; i < conlluObj.sentences.length; i++) {
		var s = conlluObj.sentences[i];
		if (s.tokens.length < 1) break;	// fix for empty trailing sentence

		for (var j = 0; j < s.tokens.length; j++) {
			var token = s.tokens[j];
			//console.log(token);
			// BUG: GT does not work on these words...
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
							<rb title="${tokenTooltip(token)}" data-lemma="${token.lemma}">${token.form}</rb>
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

class Text {
	constructor(text) {
		this.text = text;
		this.lang = this.detectLang();
		io.emit('lang', this.lang);
		this.words = this.text.split(/\W+/);	// ok
		this.wordCounts = this.countWords();
		this.wordFreqs = null;
		this.translated = null;
		this.tagged = null;
		this.level = null;
	}

	// Local franc module will detect any text's language:
	detectLang() {
		var topMatch = franc(this.text);
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
		console.info(languageCodes[topMatch][0], 'detected');
		return {
			modelName: languageCodes[topMatch][0],
			isoCode: languageCodes[topMatch][1]
		};
	}

	// Count occurrences of each word:
	countWords() {
		var counts = {};
		for (var i = 0; i < this.words.length; i++) {
			var word = this.words[i];
			if (Object.keys(counts).includes(word)) counts[word] += 1;
			else counts[word] = 1;
		}
		return counts;
	}

	// GTranslate a string:
	translateByGoogle(toLang = 'en') {
		gtr(this.text, {to: toLang}).then(res => {
			this.translated = res.text;
			io.emit('translated', this.translated);
		}).catch(err => {
			console.error(err);
		});
	}

	// Wrapper for Python wordfreqs script:
	getWordFreqs() {
		var goodWords = this.words.filter(w => w.length > 2 && !w.match(/\d/));
		var options = {
			mode: 'text',
			pythonPath: 'python',
			pythonOptions: ['-u'],
			scriptPath: '',
			args: goodWords.concat(this.lang.isoCode)
		};

		PythonShell.run('wordfreqs.py', options, function(err, results) {
			if (err) throw err;
			// results is an array consisting of messages collected during execution
			console.log('wordfreqs.py results: %j', results);

			this.wordFreqs = {};
			for (var pair of results) {
				var [word, score] = pair.split(" ");
				this.wordFreqs[word] = score;
			}
			console.dir(this.wordFreqs);
			io.emit('freqs', this.wordFreqs);
		}.bind(this));
	}

	// Make a request to the UDPipe API to tokenise, lemmatise and tag our string:
	udpipe(input, langModelName) {
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

	// Assess CEFR level of a text:
	cefr_level(text, freqDict) {
		// Average sentence length:
		var rawSentences = text.split(/[\?\.\!][\s\n]/);
		var words = text.split(/\W/);
		var avgSentLen = words.length / rawSentences.length;

		// Average word length:
		var wordLengths = words.map(w => w.length);
		var avgWordLen = Math.ceil(wordLengths.reduce((a,b) => a+b) / wordLengths.length);

		// Average freq of words (TODO:nouns?):
		var freqs = Object.values(freqDict);
		freqs = freqs.map(n => parseInt(n));
		freqs = freqs.filter(n => typeof n === 'number' && !Number.isNaN(n));
		freqs = freqs.filter(n => n >= 150 && n < 15000);
		var avgFreq = Math.ceil(freqs.reduce((a,b) => a+b) / freqs.length);

		// Percent hard words:
		// TODO

		// Tenses used:
		// TODO

		// Repetitiveness:
		// TODO

		console.log('avgSentLen', avgSentLen);		// suppose 10 - 30
		console.log('avgWordLen', avgWordLen);		// suppose 2 - 9
		console.log('avgFreq', avgFreq);	// suppose 500 - 2000

		// Compute:
		var FleschDifficulty = 207 - avgSentLen - (avgFreq / 13);
		console.log('Fdiff', FleschDifficulty);

		// Connect:
		const cefr_thresholds = [
			{name: 'C2', minpoints: 0},
			{name: 'C1', minpoints: 25},
			{name: 'B2', minpoints: 45},
			{name: 'B1', minpoints: 60},
			{name: 'A2', minpoints: 75},
			{name: 'A1', minpoints: 90},
		];

		var i = 0;
		while (i < 5) {
			if (FleschDifficulty > cefr_thresholds[i].minpoints) i++;
		}
		return {
			flesch: FleschDifficulty,
			level: cefr_thresholds[i].name,
			avgWordLen: avgWordLen,
			avgSentLen: avgSentLen,
			avgFreq: avgFreq
		};
	}

}

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
					var cefr =
					io.emit('wiki', {lang: lang, text: text, level: cefr});
				});
		})
		.catch(err => console.error(200, err));
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
	var wordlist = req.body.data.split(/\W/);
		//.reduce(t => t.length > 2);	//FIXME: problem ignoring low lengths
	//console.log(220, wordlist);
	getWordFreqs(req.body.data, wordlist, lang.isoCode);
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
			//console.log(udResult);
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
	var text = striptags(req.body.data);
	// Redis:
	var tid = text.hashCode();
	redisClient.hexists(tid, 'gtranslate', function(err,res) {	// BUG: FALSE POSITIVE?
		if (res === 1) {
			console.log("key", tid, "exists");
			redisClient.hget(tid, 'gtranslate', sendIt);
		}
		else {
			console.log("key", tid, "doesn't exist");
			translateByGoogle(text).then(trans => {
				redisClient.hset(tid, 'gtranslate', trans, sendIt);
			});
		}
	});
	function sendIt(err,trans) {
		console.log('T', trans);
		res.send(trans);
	}
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

	socket.on('text', function(data) {
		console.log("Received socket text:", data.substring(0,50));
		var t = new Text(data);
		// Split is performed in constructor
		console.log('Words', t.words);

		t.translateByGoogle();
		t.getWordFreqs();
	});
});


// SERVE:
var port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Magic happens on port ' + port);
});
