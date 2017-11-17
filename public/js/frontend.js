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
	verbix: {
		langs: {
			ca:	'cat',
			da:	'dan',
			de:	'deu',
			en:	'eng',
			es:	'spa',
			fi:	'fin',
			fr:	'fra',
			hu:	'hun',
			is:	'isl',
			it:	'ita',
			jp:	'jpn',
			ko:	'kor',
			lt:	'lit',
			nl:	'nld',
			no:	'nob',
			pt:	'por',
			ro:	'ron',
			ru:	'rus',
			sv:	'swe',
			tr:	'tur',
			ua:	'ukr'
		}
	}
};

var lookups = {
	wr: function(word) {
		// Load WR lookup in an iframe:
		if (resources.wordref.supported.includes(lang)) {
			$("#wr_frame").attr("src", resources.wordref.baseUrl + resources.wordref.queryString(word));
			focusTab('wr');
		}
	},

	leo: function(word) {

	},

	verbix: function(verb) {	// FIXME: needs infinitive / lemma form (in tooltip)
		if (Object.keys(resources.verbix.langs).includes(lang)) {
			var vlang = resources.verbix.langs[lang];
			// Build URL:
			var baseUrl = "https://api.verbix.com/conjugator/html?";
			var qlang = "language="+vlang;
			var qtable = "tableurl=http://tools.verbix.com/webverbix/personal/template.htm";
			var qverb = "verb="+verb;
			var fullUrl = baseUrl + [qlang, qtable, qverb].join("&");
			console.log(fullUrl);
			// Load content into frame:
			$("#verbix_frame").attr("src", fullUrl);
			focusTab('verbix');
		}
	},

	glosbe: function(word) {
		var glosbeUrl = "https://glosbe.com/gapi/translate?from="+lang+"&dest=eng&format=json&phrase="+word+"&pretty=true&callback=bob";
		//FIXME: Glosbe API not reachable due to CORS from 127.0.0.1
		$.get(glosbeUrl, function(resp) {
			console.log('R', resp);
		});
	}
};


// jQuery has loaded, document too:
$(document).ready(function() {

	var $tagged = $("#tagged");
	var $output = $("#output");

	// Do it!-button behaviour:
	$("#goBtn").on('click', function(e) {
		e.preventDefault();
		var text = $("#source").html();
		// Send text to backend via socket:
		socket.emit('text', text);
	});

	// Grammar display toggles:
	$("input").on('change', function() {
		switch ($(this).attr("name")) {
			case "showperword":
				if (this.checked) $tagged.find("ruby rt:first-of-type").show();
				else $tagged.find("ruby rt:first-of-type").hide();
				break;

			case "showranks":
				if (this.checked) $tagged.find("ruby rt:last-of-type").show();
				else $tagged.find("ruby rt:last-of-type").hide();
				break;

			case "showgenders":
				if (this.checked) $tagged.addClass("genders_on");
				else $tagged.removeClass("genders_on");
				break;

			case "showcases":
				if (this.checked) $tagged.addClass("cases_on");
				else $tagged.removeClass("cases_on");
				break;

			default:
				console.log(this);
				break;
		}
	});

	// Make words clickable:
	$("#tagged").on('click', 'rb', function() {
		// Should lookup be done by simple click, by contextual menu or by tool?
		lookups.glosbe(this.innerHTML);
		lookups.verbix($(this).data("lemma"));
	});


	// Panel behaviours:
	$("#panelToggle").on('click', function() {
		$("#panel, #panelToggle").toggleClass("open");
	});
	$("#panel li").on('click', function() {
		// Show and hide tab sections based on list id:
		var target = $(this).attr("id");
		var num = Array.prototype.indexOf.call($("#panel li"), this) + 1;
		console.log(num);
		$("#panel section").hide();
		$("#panel #"+target).show();
	});


	// Load example articles when dropdown changes:
	// TODO: save these for some time
	// TODO: delete and remember bad ones
	$("header select").on('change', function() {
		console.log(this.value, 'selected');
		lang = this.value;
		$.get('/wikipedia/'+lang+'/3', resp => console.log(resp));
	});

	// Example card -> source loader:
	$("#examples").on('click', 'li', function(e) {
		$("#source").html(e.target.innerHTML).addClass($(this).data("lang"));
	});


	// Receive franc-detected language from Node:
	socket.on('lang', function(lang) {
		console.log(lang);
		$("h2:first-of-type span").html("["+lang.modelName+" detected]");
		$output.data("lang", lang.isoCode).addClass(lang.isoCode);
		if (['de','ru','gr','pl'].includes(lang.isoCode)) {
			$tagged.addClass('cases_on');
		}
		else {
			$tagged.removeClass('cases_on');
		}
	});

	// Receive tagged text as HTML from Node:
	socket.on('tagged', function(html) {
		$tagged.html(html);
		// Generate token tooltips:
		tippy("rb");
	});

	// Receive word frequencies from Node:
	socket.on('freqs', function(freqs) {
		console.log('freqs', freqs);
		var lang = $("#output").data("lang") || '';
		// Append the frequencies to the output text tooltips:
		for (var word of Object.keys(freqs)) {
			$("#tagged").find("#"+lang+"_"+word).find("rt:nth-of-type(2)").html(freqs[word]);
		}
	});

	// Receive a new wiki article from Node:
	socket.on('wiki', function(resp) {
		console.log(resp);
		$("#examples").append($("<li>").addClass(resp.lang).html(resp.text));
	});

	// Receive a CEFR level from Node:
	socket.on('cefr', function(resp) {
		console.log(resp);
	});

	// Load external pages:
	//$("#wr_frame").attr("src", "http://www.wordreference.com");
	//$("#leo_frame").attr("src", "http://dict.leo.org");
	//$("#verbix_frame").attr("src", "http://www.verbix.com");

});

function focusTab(tab) {
	$("#panel, #panelToggle").addClass("open");
	$("#panel section").hide();
	$("#panel").find("#"+tab+"_tab").show();

}
