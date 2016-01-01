/**
 * Create a stripped websocket-server using the sample code from:
 * https://github.com/Worlize/WebSocket-Node#server-example
 * 
 */
var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'
var broadcastTo = [];

// Require the modules we need
var WebSocketServer = require('ws').server;
var http = require('http');

/**
 * Create a http server with a callback for each request
 *
 */
var httpServer = http.createServer(function(request, response) {
  console.log((new Date()) + ' Received request for ' + request.url);
  response.writeHead(200, {'Content-type': 'text/plain'});
  response.end('Hello world\n');
}).listen(server_port, server_ip_address, function() {
  console.log((new Date()) + ' HTTP server is listening on port ' + server_port);
});

/**
 * Create an object for the websocket
 * https://github.com/Worlize/WebSocket-Node/wiki/Documentation
 */
wsServer = new WebSocketServer({
  httpServer: httpServer,
  autoAcceptConnections: false
});

/**
 * Always check and explicitly allow the origin
 *
 */
function originIsAllowed(origin) {
  return true;
  if(origin === 'http://www.student.bth.se' || origin === 'http://www.volvo-s90.com') {
      //origin === 'http://localhost' ||
    return true;    
  }
  return false;
}

/**
 * Accept connection under the echo-protocol
 *
 */
function acceptConnectionAsEcho(request, subprotocol) {
  if(subprotocol === undefined) {
    subprotocol = 'echo-protocol';
  }
  var connection = request.accept(subprotocol, request.origin);
  console.log((new Date()) + ' Echo connection accepted from ' + request.origin);

  // Callback to handle each message from the client
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log('Received Message: ' + message.utf8Data);
      connection.sendUTF('Echo: ' + message.utf8Data);
    }
    else if (message.type === 'binary') {
      console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
      connection.sendBytes(message.binaryData);
    }
  });
  
  // Callback when client closes the connection
  connection.on('close', function(reasonCode, description) {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
  });

  return true;
}

/**
 * Avoid injections
 *
 */
function htmlEntities(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Accept connection under the broadcast-protocol
 *
 */
function acceptConnectionAsBroadcast(request) {
  var connection = request.accept('broadcast-protocol', request.origin);
  connection.broadcastId = broadcastTo.push(connection) - 1;
  console.log((new Date()) + ' Broadcast connection accepted from ' + request.origin + ' id = ' + connection.broadcastId);

  // Callback to handle each message from the client
  connection.on('message', function(message) {
    var clients = 0;
    for(var i=0; i<broadcastTo.length; i++) {
      if(broadcastTo[i]) {
        clients++;
        broadcastTo[i].sendUTF('Broadcast: ' + htmlEntities(message.utf8Data));
      }
    }
    console.log('Broadcasted message to ' + clients + ' clients: ' + message.utf8Data);
  });
  
  // Callback when client closes the connection
  connection.on('close', function(reasonCode, description) {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected broadcastid = ' + connection.broadcastId + '.');
    broadcastTo[connection.broadcastId] = null;
  });

  return true;
}

/**
 * Accept connection under the chat-protocol
 *
 */
function acceptConnectionAsChat(request) {
  var connection = request.accept('chat-protocol', request.origin);
  connection.broadcastId = broadcastTo.push(connection) - 1;
  connection.username = false;
  console.log((new Date()) + ' Broadcast connection accepted from ' + request.origin + ' id = ' + connection.broadcastId);

  // Callback to handle each message from the client
  connection.on('message', function(message) {
          // First message sent by user is their name
    if (connection.username === false) {
        connection.username = htmlEntities(message.utf8Data);
        console.log((new Date()) + ' User is known as: ' + connection.username);
    } else {
        var clients = 0;
        for(var i=0; i<broadcastTo.length; i++) {
            if(broadcastTo[i]) {
                clients++;
                broadcastTo[i].sendUTF(htmlEntities(connection.username + ' says: ' + message.utf8Data));
            }
        }
        console.log('Broadcasted message to ' + clients + ' clients: ' + message.utf8Data);
    }
  });
  
  // Callback when client closes the connection
  connection.on('close', function(reasonCode, description) {
    console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected broadcastid = ' + connection.broadcastId + '.');
    broadcastTo[connection.broadcastId] = null;
  });

  return true;
}

/**
 * Create a callback to handle each connection request
 *
 */
wsServer.on('request', function(request) {
  var status = null;

  if (!originIsAllowed(request.origin)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
    return;
  }

  // Loop through protocols. Accept by highest order first.
  for (var i=0; i < request.requestedProtocols.length; i++) {
    if(request.requestedProtocols[i] === 'chat-protocol') {
      status = acceptConnectionAsChat(request);
    } else if(request.requestedProtocols[i] === 'broadcast-protocol') {
      status = acceptConnectionAsBroadcast(request);
    } else if(request.requestedProtocols[i] === 'echo-protocol') {
      status = acceptConnectionAsEcho(request);
    }
  };

  // Unsupported protocol.
  if(!status) {
    //acceptConnectionAsEcho(request, null);
    console.log('Subprotocol not supported');
    request.reject(403, 'Subprotocol not supported, only supporting "echo-protocol" or "broadcast-protocol or "chat-protocol"".');
  }

});
