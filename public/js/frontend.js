/* global $, tippy */

// jQuery has loaded, document too:
$(document).ready(function() {

	// Analyse!-button behaviour:
	$("#goBtn").on('click', function(e) {
		e.preventDefault();

		var text = $("#source").html();
		var lang;

		$.post('/detect', {data: text}, function(resp) {
			console.log("Server response", resp);
			lang = resp;
			$("h2:first-of-type span").html("["+lang+" detected]");
		});

		// Then:

		$.post('/translate', {data: text}, function(resp) {
			console.log("Server response", resp);
			// Do something with it
		});

		$.post('/process', {data: text, lang: lang}, function(resp) {
			console.log("Server response", resp);
			$("#output").html(resp);
			// Generate token tooltips:
			tippy("span");
		});
	});

	// Examples loader:
	$("#examples li").on('click', function() {
		$("#source").html(this.innerHTML);
	});


});
