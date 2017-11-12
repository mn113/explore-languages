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

		$.post('/translate', {data: text}, function(resp) {
			console.log("Server response", resp);
			$("#translated").html(resp);
		});

		$.post('/frequencies', {data: text}, function(resp) {
			console.log("Server response", resp);
			// Do something with it
		});

		$.post('/process', {data: text}, function(resp) {
			console.log("Server response", resp);
			$("#tagged").html(resp);
			// Generate token tooltips:
			tippy("rb");
		});
	});

	// Examples loader:
	$("#examples li").on('click', function() {
		$("#source").html(this.innerHTML);
	});


});
