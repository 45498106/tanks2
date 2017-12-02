"use strict";
var http = require("http");
var express = require("express");
var app = express().use(express.static(__dirname + "/public/"));
var port = process.env.PORT || 8080;
var server = http.createServer(app).listen(port, function() {
  console.log("Listening on %d", server.address().port);
});
var WebSocket = require("ws");
var wss = new WebSocket.Server({server});
var players = {};
var id = 0; //ID will start from 1
////////////////////////////////////////////////////////////////////////////////
wss.on("connection", function(ws) {

  ws.on("message", function(data) {
    try {var packet = JSON.parse(data);}
    catch (error) {console.log("Invalid JSON");}

    if (packet.start) {
      ws.id = getID();
      players[ws.id] = ws;
      sendStartPacket(ws.id);
      sendAddPacket(ws.id);

    } else if (packet.ping) {
      sendTo(ws.id, {ping:"ping"});

    } else if (packet.to == "broadcast") {
      broadcast(packet);

    } else if (packet.to != "broadcast") {
      sendTo(packet.to, packet);
    }
  });//message

  ws.on("close", function(event) {
    delete players[ws.id];
    broadcast({remove:ws.id});
  });//close
});//connection
////////////////////////////////////////////////////////////////////////////////
function getID() {
  var maxID = 65534/2;
  if (++id > maxID) {id = 1;}
  return id;
}
////////////////////////////////////////////////////////////////////////////////
function sendStartPacket(newID) {
  var packet = {};
  for (var id in players) {packet[id] = id;}
  sendTo(newID, {start:packet, id:newID});
}
////////////////////////////////////////////////////////////////////////////////
function sendAddPacket(newID) {
  broadcast({add:newID}, newID);
}
////////////////////////////////////////////////////////////////////////////////
function broadcast(packet, except) {
  for (var id in players) {
    if (id == except) {continue;}
    sendTo(id, packet);
  }
}
////////////////////////////////////////////////////////////////////////////////
function sendTo(id, packet) {
  if (!players[id] || players[id].readyState !== 1) {return;}
  players[id].send(JSON.stringify(packet));
}
////////////////////////////////////////////////////////////////////////////////
