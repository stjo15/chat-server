var WebSocket = require('ws')
, ws = new WebSocket('ws://nodesocket-cdaley.rhcloud.com:8000');
ws.on('open', function() {
	ws.send('something');
});
ws.on('message', function(message) {
	console.log('received: %s', message);
});