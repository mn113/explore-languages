/* global $ */

// jQuery has loaded, document too:
$(document).ready(function() {

	// Analyse!-button behaviour:
	$("#goBtn").on('click', function() {
		var sentence = $("#source p").html();
		var lang;

		$.post('/detect', {data: sentence}, function(resp) {
			console.log("Server response", resp);
			lang = resp;
		});

		// Then:

		$.post('/process', {data: sentence, lang: lang}, function(resp) {
			console.log("Server response", resp);
			$("#output").html(resp);
		});
	});

});
