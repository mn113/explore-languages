/* global $, tippy, io */

var socket = io();
var lang = 'en';	// cookie or ls?

var resources = {
	wordref: {
		supported: ['fr','es','it','pt','de','nl','sv','ru','pl','cz','ro','tr','ar','zh','jp','ko'],
		baseUrl: "http://www.wordreference.com/",
		queryString: term => lang+"en/"+term,
//		searchUrl: term => { this.supported.includes(lang) ? }
		cat: "definicio/%term%"
	},
	leo: {},
};

// jQuery has loaded, document too:
$(document).ready(function() {

	// Do it!-button behaviour:
	$("#goBtn").on('click', function(e) {
		e.preventDefault();

		var text = $("#source").html();

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
			//console.log("Server response", resp);
			$("#tagged").html(resp);
			// Generate token tooltips:
			tippy("rb");
		});
	});

	// Toggles: TODO: consolidate eventListeners
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


	// Panel behaviour:
	$("#panelToggle").on('click', function() {
		$("#panel, #panelToggle").toggleClass("open");
	});

	$("#panel li").on('click', function() {
		// Show and hide tab sections based on list index:
		var num = Array.prototype.indexOf.call($("#panel li"), this) + 1;
		console.log(num);
		$("#panel section").hide();
		$("#panel section:nth-of-type("+num+")").show();
	});


	// Load example articles when dropdown changes:
	$("header select").on('change', function() {
		console.log(this.value);
		lang = this.value;
		$.get('/wikipedia/'+lang+'/3', resp => console.log(resp));
	});

	// Examples loader:
	$("#examples").on('click', 'li', function(e) {
		$("#source").html(e.target.innerHTML).addClass($(this).data("lang"));
	});


//	$('form').submit(function(){
//		socket.emit('chat message', $('#m').val());
//		return false;
//	});
	socket.on('lang', function(lang) {
		console.log(lang);
		$("h2:first-of-type span").html("["+lang.modelName+" detected]");
		$("#output").data("lang", lang.isoCode).addClass(lang.isoCode);
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

	// Load external pages:
	$("#wr_frame").attr("src", "http://www.wordreference.com");
	$("#leo_frame").attr("src", "http://dict.leo.org");
	//$("#lexi_frame").attr("src", "http://www.lexilogos.com");	FIXME: takes over my page
	$("#verbix_frame").attr("src", "http://www.verbix.com");

	// Make words clickable:
	$("#tagged").on('click', 'rb', function() {
		console.log(this);
		// Should lookup be done by click, by contextual menu or by tool?
		lookupWord(this.innerHTML);
	});

});

function lookupWord(word, source) {
	// Go through Node at all? NO
	var glosbeUrl = "https://glosbe.com/gapi/translate?from="+lang+"&dest=eng&format=json&phrase="+word+"&pretty=true&callback=bob";
	$.get(glosbeUrl, function(resp) {
		console.log('R', resp);
	});
	//const bob = console.log;

	// Load WR lookup in an iframe:
	if (resources.wordref.supported.includes(lang)) {
		$("#wr_frame").attr("src", resources.wordref.baseUrl + resources.wordref.queryString(word));
		focusTab('wr');
	}

}

function focusTab(tab) {
	$("#panel, #panelToggle").addClass("open");
	$("#panel section").hide();
	$("#panel").find("#"+tab+"_tab").show();

}
