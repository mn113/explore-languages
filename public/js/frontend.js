/* global $, tippy */

// jQuery has loaded, document too:
$(document).ready(function() {

	// Analyse!-button behaviour:
	$("#goBtn").on('click', function() {
		var sentence = $("#source").html();
		var lang;

		$.post('/detect', {data: sentence}, function(resp) {
			console.log("Server response", resp);
			lang = resp;
		});

		// Then:

		$.post('/process', {data: sentence, lang: lang}, function(resp) {
			console.log("Server response", resp);
			$("#output").html(resp);
			// Generate token tooltips:
			tippy("span");
		});
	});

	$("#examples li").on('click', function() {
		$("#source").html(this.innerHTML);
	});

	$("#output span").on('hover', function() {
		//console.log($(this).data);
	});

});
