/* global $ */

// jQuery has loaded, document too:
$(document).ready(function() {

	$("#goBtn").on('click', function() {
		// Send data to server
		var sentence = $("#source p").html();
		$.post('http://127.0.0.1:3000/process', {data: sentence}, function(resp) {
			console.log("Server response", resp);
			$("#output").html(resp);
		});
	});

});
