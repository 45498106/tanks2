"use strict";
var players = {};
var input   = 0;
var my      = {id:0, name:""};
var time    = {then:0, now:0, passed:0};

var websocket = new WebSocket(window.location.origin.replace(/^http/, "ws"));

var configuration = {iceServers:[
	{url:"stun:stun.l.google.com:19302"},
	{url:"stun:stun1.l.google.com:19302"},
	{url:"stun:stun2.l.google.com:19302"},
	{url:"stun:stun3.l.google.com:19302"},
	{url:"stun:stun4.l.google.com:19302"},
]};

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function start() {
	my.name = document.getElementById("name").value;
	if (my.name.length <= 0 || my.name.length > 10) {alert("Bad name."); return;}
	if (my.name == "name") {alert("Haha."); return;}

	if (websocket.readyState != 1) {alert("No connection to server."); return;}
	if (!window.Promise) {alert("Promise is not supported."); return;}

	try {var dataChannel = new RTCPeerConnection().createDataChannel("");}
	catch (error){console.log(error.message);}
  if (!dataChannel) {alert("DataChannel is not supported."); return;}

	//Success
	document.getElementById("welcome").style.display = "none";
	websocket.send(JSON.stringify({start:"start"}));
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
websocket.onopen = function() {

};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
websocket.onclose = function() {
	//alert("Lost connection to server.")
	location.reload();
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
websocket.onmessage = function(msg) {
	var packet = JSON.parse(msg.data);

	if (packet.start) {
		my.id = packet.id;
		console.log("My ID:"+my.id);
		for (var id in packet.start) {addPlayer(id, true);}
		time.then = Date.now();
		frames();

	} else if (packet.add) {
		addPlayer(packet.add, false);

	} else if (packet.remove) {
		delete players[packet.remove];

	} else if (packet.offer) {
		console.log("offer received");
		var pc = players[packet.from].pc;
		pc.setRemoteDescription(packet.offer)
			.then(function()       {return pc.createAnswer();})
			.then(function(answer) {return pc.setLocalDescription(answer);})
			.then(function()       {sendToServer({answer:pc.localDescription, to:packet.from, from:my.id});})
			.catch(logError);
		console.log("answer sent");

	} else if (packet.answer) {
		players[packet.from].pc.setRemoteDescription(packet.answer).catch(logError);
		console.log("answer received");

	} else if (packet.candidate) {
		players[packet.from].pc.addIceCandidate(packet.candidate).catch(logError);
		console.log("candidate received");

	} else if (packet.shot) {
		if (players[my.id].dead) {return;}
		players[my.id].dead = true;
		sendToServer({kill:packet.from, to:"broadcast"});

	} else if (packet.kill) {
		players[packet.kill].kills += 1;

	} else if (packet.ping) {
		ping.receive();

	}
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function addPlayer(id, isInitiator) {
	players[id] = new Player();
	if (id == my.id) {players[id].name = my.name; return;}
	players[id].pc = new RTCPeerConnection(configuration);
	var pc = players[id].pc;
	pc.onicecandidate = function(event) {sendToServer({candidate:event.candidate, to:id, from:my.id});};

	if (isInitiator) {
		pc.onnegotiationneeded = function() {
			pc.createOffer()
			.then(function(offer) {return pc.setLocalDescription(offer);})
			.then(function()      {sendToServer({offer:pc.localDescription, to:id, from:my.id}); console.log("Offer sent");})
			.catch(logError);
		};
	}

	players[id].channel = pc.createDataChannel("",{negotiated:true, ordered:false, maxRetransmits:0, id:Number(id) + Number(my.id)});
	players[id].channel.onopen    = function(event) {console.log("Connected to ID:"+getID(event)); sendFullUpdate(getID(event));};
	players[id].channel.onclose   = function(event) {console.log("Disconnected ID:"+getID(event)); delete players[getID(event)];};
	players[id].channel.onerror   = function(event) {console.log("ERROR");};
	players[id].channel.onmessage = function(event) {receiveMessage(event);};
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function logError(error) {
  console.log(error.name + ": " + error.message);
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function getID(msg) {
	return Number(msg.target.id) - Number(my.id);
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function receiveMessage(msg) {
	var id = getID(msg);
	var packet = JSON.parse(msg.data);

	if (packet.name) {
		for (var property in packet) {players[id][property] = packet[property];}
		players[id].ackStep = packet.step;
		console.log("Update received");
		return;
	}

	//They ack my steps
	for (var step in players[id].bufferSend) {
		if (step > packet.ackStep) {break;}
		delete players[id].bufferSend[step];
	}

	delete packet.ackStep;

	//I ack their steps
	for (var step in packet) {
		while (players[id].ackStep < step) {
			players[id].inputs.push(packet[step]);
			players[id].ackStep += 1;
		}
	}

}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function sendFullUpdate(id) {
	var packet = {
		name      : players[my.id].name,
		step      : players[my.id].step,
		x         : players[my.id].x,
		y         : players[my.id].y,
		dead      : players[my.id].dead,
		kills     : players[my.id].kills,
		angleBase : players[my.id].angleBase,
	};
	sendToPlayer(id, packet);
	console.log("Update sent");
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function isConnected(id) {
	if (players[id].channel && players[id].channel.readyState == "open") {return true;}
	else {return false;}
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function sendToServer(packet) {
	if (websocket.readyState !== 1) {return;}
	try {websocket.send(JSON.stringify(packet));}
	catch (error) {console.log(error.message);}
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function sendToPlayer(id, packet) {
	if (!isConnected(id)) {return;}
	try {players[id].channel.send(JSON.stringify(packet));}
	catch (error) {console.log(error.message);}
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function broadcast(packet) {
	for (var id in players) {
		if (id == my.id) {continue;}
		players[id].bufferSend.ackStep = players[id].ackStep;
		sendToPlayer(id, players[id].bufferSend);
		delete players[id].bufferSend.ackStep;
	}
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function getEnemies(except) {
	var enemies = {};
	for (var id in players) {
		if (id == except) {continue;}
		if (players[id].name == "name") {continue;}
		enemies[id] = players[id];
	}
	return enemies;
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function processOthers() {
	for (var id in players) {
		if (id == my.id) {continue;}
		if (players[id].inputs.length == 0) {players[id].buffering = true;}
		if (players[id].inputs.length >= 5) {players[id].buffering = false;}
		if (players[id].buffering) {continue;}

		do {
			players[id].move(players[id].inputs[0]);
			if (players[id].shooting) {players[id].shoot(getEnemies(id));}
			players[id].inputs.shift();
		} while (players[id].inputs.length > 5);
	}//for (var id in players)
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function processMe() {
	var capturedInput = input;
	if (players[my.id].dead) {capturedInput |= flag.dead;}
	players[my.id].move(capturedInput);
	if (players[my.id].shooting) {var shotID = players[my.id].shoot(getEnemies(my.id));}
	if (shotID) {sendToServer({shot:"shot", to:shotID, from:my.id});}
	addToBufferSend(players[my.id].step, capturedInput);
	broadcast();
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function addToBufferSend(step, input) {
	for (var id in players) {
		if (id == my.id)      {continue;}
		if (!isConnected(id)) {continue;}

		players[id].bufferSend[step] = input;
		var previousInput = players[id].bufferSend[step-1];
		if (previousInput && (previousInput<<20 == input<<20)) {delete players[id].bufferSend[step-1];}
	}
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function frames() {
	time.now = Date.now();
	time.passed += time.now - time.then;
	fps.add();
	ping.send();
	physics();
	draw();
	time.then = time.now;
	window.requestAnimationFrame(frames);
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
function physics() {
	while (time.passed >= step) {
		time.passed -= step;
		processOthers();
		processMe();
	}
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
window.addEventListener("keydown", function(event) {
	if (event.keyCode === 38 || event.keyCode === 87) {input |= flag.forward;}
	if (event.keyCode === 40 || event.keyCode === 83) {input |= flag.backward;}
	if (event.keyCode === 37 || event.keyCode === 65) {input |= flag.leftTurn;}
	if (event.keyCode === 39 || event.keyCode === 68) {input |= flag.rightTurn;}
	if (event.keyCode === 82)                         {input |= flag.resurrect;}
}, false);

window.addEventListener("keyup", function(event) {
	if (event.keyCode === 38 || event.keyCode === 87) {input &= ~flag.forward;}
	if (event.keyCode === 40 || event.keyCode === 83) {input &= ~flag.backward;}
	if (event.keyCode === 37 || event.keyCode === 65) {input &= ~flag.leftTurn;}
	if (event.keyCode === 39 || event.keyCode === 68) {input &= ~flag.rightTurn;}
	if (event.keyCode === 82)                         {input &= ~flag.resurrect;}
}, false);

window.onmousedown = function(event) {input |=  flag.shoot;};
window.onmouseup   = function(event) {input &= ~flag.shoot;};

window.onmousemove = function(event) {
	var dx = event.x - canvas.width/2;
	var dy = event.y - canvas.height/2;
	var angle = Math.atan2(dy, dx);               // -PI <= angle <= PI
	//console.log(angle);
	if (angle < 0) {angle = 2 * Math.PI + angle;} // 0 <= angle <= 2PI
	var section = (512 * angle)/(2 * Math.PI);    // 0 <= section <= 512
	section = Math.round(section);                // round section
	input = input << 9 >>> 9;             // clear previous angle
	section = section << 23;                      // shift new angle
	input += section;                         // save new angle
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var ping = {
	values : [],
	sent   : [],

	send : function() {
		this.sent.push(Date.now());
		websocket.send(JSON.stringify({ping:"ping"}));
	},

	receive : function() {
		this.values.push(Date.now() - this.sent[0]);
		this.sent.shift();
		if (this.values.length > 25) {this.values.shift();}
	},

	get : function() {
		if (this.values.length === 0) {return 0;}
		var sum = 0;
		for (var i = 0; i < this.values.length; i++) {sum += this.values[i];}
		return Math.round(sum/this.values.length);
	}
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var fps = {
	values : [],

	add : function() {
		this.values.push(1000/(time.now - time.then));
		if (this.values.length > 20) {this.values.shift();}
	},

	get : function() {
		if (this.values.length === 0) {return 0;}
		var sum = 0;
		for (var i = 0; i < this.values.length; i++) {sum += this.values[i];}
		return Math.round(sum/this.values.length);
	}
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", function(){
	canvas.width  = window.innerWidth;
	canvas.height = window.innerHeight;
}, false);

function draw() {
	if (players.length === 0) {return;}

	var camera = {
		x : canvas.width/2  - players[my.id].x,
		y : canvas.height/2 - players[my.id].y
	};

	//Reset
	ctx.fillStyle = "#eeeeee";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	//Arena
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(camera.x, camera.y, arena.width, arena.height);

	//Lines
	ctx.strokeStyle = "#eeeeee";
	for (var i = 50; i < arena.width; i += 50) {
		ctx.beginPath();
		ctx.moveTo(i+camera.x, 0+camera.y);
		ctx.lineTo(i+camera.x, arena.height+camera.y);
		ctx.stroke();
	}

	for (var i = 50; i < arena.height; i += 50) {
		ctx.beginPath();
		ctx.moveTo(0+camera.x, i+camera.y);
		ctx.lineTo(arena.width+camera.x, i+camera.y);
		ctx.stroke();
	}

	//Tanks
	for (var id in players) {
		if (players[id].name == "name") {continue;}
		ctx.strokeStyle = "#000000";
		ctx.save();
		ctx.translate(players[id].x + camera.x, players[id].y + camera.y);
		ctx.rotate(players[id].angleBase);

		//Front and Rear
		ctx.beginPath();
		ctx.moveTo(tank.width/2, -tank.height/2);
		ctx.lineTo(tank.width/1.5, 0);
		ctx.lineTo(tank.width/2,  tank.height/2);
		ctx.moveTo(-tank.width/2, -tank.height/2);
		ctx.lineTo(-tank.width/2,  tank.height/2);
		ctx.stroke();

		//Sides
		ctx.beginPath();
		ctx.lineWidth = 5;
		ctx.moveTo(-tank.width/2, -tank.height/2);
		ctx.lineTo( tank.width/2, -tank.height/2);
		ctx.moveTo(-tank.width/2,  tank.height/2);
		ctx.lineTo( tank.width/2,  tank.height/2);
		ctx.stroke();

		//Gun
		ctx.beginPath();
		ctx.rotate(players[id].angleGun - players[id].angleBase);
		ctx.moveTo(0, 0);
		ctx.lineTo(tank.width, 0);
		ctx.stroke();

		ctx.restore();

		//Name
		ctx.fillStyle = "#000000";
		ctx.fillText(players[id].name+" ("+players[id].kills+")", players[id].x + camera.x - tank.width, players[id].y + camera.y - tank.height);

		//Dead
		if (players[id].dead) {
			ctx.save();
			ctx.translate(players[id].x + camera.x, players[id].y + camera.y);
			ctx.rotate(-Math.PI/4);
			ctx.font = "bold 25px Helvetica";
			ctx.fillStyle = "#FF4136";
			ctx.fillText("DEAD", 0 - tank.width, 0);
			ctx.restore();
		}

		//Bullets
		for (var b = 0; b < players[id].bullets.length; b++) {
			ctx.beginPath();
			ctx.strokeStyle = "rgba(0, 0, 0, " + players[id].bullets[b].fade + ")";
			ctx.moveTo(players[id].bullets[b].start.x + camera.x, players[id].bullets[b].start.y + camera.y);
			ctx.lineTo(players[id].bullets[b].end.x + camera.x, players[id].bullets[b].end.y + camera.y);
			ctx.stroke();
		}
		ctx.strokeStyle = "#000000"; //reset
	}

	//Info
	ctx.font = "15px Helvetica";
	ctx.fillText("Press R to resurrect", 15, 30);
	ctx.fillText("Ping: " + ping.get(), 15, 60);
	ctx.fillText("FPS: "  + fps.get(),  15, 90);
}
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
