/* global $, tippy, io */

var socket = io();

// jQuery has loaded, document too:
$(document).ready(function() {

	// Analyse!-button behaviour:
	$("#goBtn").on('click', function(e) {
		e.preventDefault();

		var text = $("#source").html();
		var lang;

		$.post('/detect', {data: text}, function(resp) {
			console.log("Server response", resp);
			lang = resp.isoCode;
			$("h2:first-of-type span").html("["+lang+" detected]");
			$("#output").data("lang", lang);
		});

		$.post('/translate', {data: text}, function(resp) {
			console.log("Server response", resp);
			$("#translated").html(resp);
		});

		$.post('/frequencies', {data: text}, function(resp) {
			console.log("Server response", resp);
			// Response handled by socket.on
		});

		$.post('/process', {data: text}, function(resp) {
			console.log("Server response", resp);
			$("#tagged").html(resp);
			// Generate token tooltips:
			tippy("rb");
		});
	});

	// Toggles:
	$("input[name=showperword]").on('click', function() {
		if (this.checked) $("#tagged ruby rb:first-of-type").css("display: block");
		else $("#tagged ruby rb:first-of-type").css("display: none");
	});

	$("input[name=showranks]").on('click', function() {
		if (this.checked) $("#tagged ruby rb:last-of-type").css("display: block");
		else $("#tagged ruby rb:last-of-type").css("display: none");
	});

	$("input[name=showgenders]").on('click', function() {
		//if (this.checked) $("#tagged ruby rb:first-of-type").css("display: block");
		//else $("#tagged ruby rb:first-of-type").css("display: none");
	});

	$("input[name=showcases]").on('click', function() {
		//if (this.checked) $("#tagged ruby rb:first-of-type").css("display: block");
		//else $("#tagged ruby rb:first-of-type").css("display: none");
	});


	// Examples loader:
	$("#examples").on('click', 'li', function(e) {
		$("#source").html(e.target.innerHTML);
	});

	// Fetch random Wiki articles on load:
	$.get('/wikipedia/fr/1', resp => console.log(resp));
	$.get('/wikipedia/es/1', resp => console.log(resp));
	$.get('/wikipedia/de/1', resp => console.log(resp));
	//$.get('/wikipedia/it/1', resp => console.log(resp));
	//$.get('/wikipedia/sv/1', resp => console.log(resp));
	//$.get('/wikipedia/ru/1', resp => console.log(resp));
	$.get('/wikipedia/el/1', resp => console.log(resp));


//	$('form').submit(function(){
//		socket.emit('chat message', $('#m').val());
//		return false;
//	});
	socket.on('lang', function(lang) {
		console.log(lang);
		$("h2:first-of-type span").html("["+lang.modelName+" detected]");
		$("#output").data("lang", lang.isoCode);
	});

	socket.on('freqs', function(freqs) {
		console.log(freqs);
		var lang = $("#output").data("lang") || '';
		// Append the frequencies to the output text tooltips:
		for (var word of Object.keys(freqs)) {
			$("#tagged").find("#"+lang+"_"+word).find("rt:nth-of-type(2)").html(freqs[word]);
		}
	});

	// Receive a wiki article from Node:
	socket.on('wiki', function(resp) {
		console.log(resp);
		$("#examples").append($("<li>").addClass(resp.lang).html(resp.text));
	});
});

function lookupWord(word, lang, source) {
	// Go through Node at all? NO
	var glosbeUrl = "https://glosbe.com/gapi/translate?from="+lang+"&dest=eng&format=json&phrase="+word+"&pretty=true&callback=bob";
	$.get(glosbeUrl, function(resp) {
		console.log('R', resp);
	});
	//const bob = console.log;

	// Load WR in an iframe:
	var wordrefUrl = "http://www.wordreference.com/iten/cazzo";
	$("#guest_frame").attr("src", wordrefUrl);
}
lookupWord('chameau', 'fra', 'glosbe');
