"use strict";
var step = 25; //ms
var tank  = {width:25,   height:25, radius:12.5};
var arena = {width:1000, height:1000};
var flag = {
	forward   : 1,
	backward  : 2,
	leftTurn  : 4,
	rightTurn : 8,
	shoot     : 16,
	resurrect : 32,
	dead      : 64,
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var Player = function() {
	this.name = "name";
	this.step = 0;
	this.ackStep = 0;
	this.x = 100;
  this.y = 100;
	this.kills = 0;
	this.angleGun = 0;
	this.angleBase = 0;
	this.speedMove = 200;
	this.speedRotate = Math.PI;

	this.shooting = false;
	this.shotStep  = 0;
	this.shotDelay = 20;
	this.shotRange = 200;
	this.bullets = [];

	this.dead = false;
	this.deadStep = 0;
	this.deadDelay = 20;

	this.buffering = true;
	this.inputs = [];
	this.bufferSend = {};
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
Player.prototype.move = function(input) {
	this.step += 1;

	//Bullets
	for (var i = 0; i < this.bullets.length; i++) {
		this.bullets[i].fade -= 0.05;
		if (this.bullets[i].fade <= 0) {this.bullets.splice(i, 1);}
	}

	//Resurrect
	if ((input & flag.resurrect) && (input & flag.dead)) {
		this.dead = false;
		return;
	}

	//Dead
	if (input & flag.dead) {
		this.dead = true;
		return;
	}

  //Moving
	var move = this.speedMove * step / 1000;
	var moveX = Math.cos(this.angleBase) * move;
	var moveY = Math.sin(this.angleBase) * move;

	if (input & flag.forward) {
		if (this.x - tank.width/2  + moveX >= 0 && this.x + tank.width/2  + moveX <= arena.width)  {this.x += moveX;}
		if (this.y - tank.height/2 + moveY >= 0 && this.y + tank.height/2 + moveY <= arena.height) {this.y += moveY;}
	}

	if (input & flag.backward) {
		if (this.x - tank.width/2  - moveX >= 0 && this.x + tank.width/2  - moveX <= arena.width)  {this.x -= moveX;}
		if (this.y - tank.height/2 - moveY >= 0 && this.y + tank.height/2 - moveY <= arena.height) {this.y -= moveY;}
	}

	//Rotate
	var rotate = this.speedRotate * step / 1000;
	if (input & flag.leftTurn)  {this.angleBase -= rotate;}
	if (input & flag.rightTurn) {this.angleBase += rotate;}

	//Angle
	this.angleGun = (input >>> 23) * (2 * Math.PI) / 512;
	if (this.angleGun > Math.PI) {this.angleGun -= (2 * Math.PI);}

	//Shooting
	if ((input & flag.shoot) && (this.step >= this.shotStep + this.shotDelay)) {
		this.shotStep = this.step;
		this.shooting = true;
  }
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
Player.prototype.shoot = function(enemies) {
	this.shooting = false;

	//Check range
	for (var id in enemies) {
		if (enemies[id].dead) {delete enemies[id]; continue;}
		var rangeX = enemies[id].x - this.x;
  	var rangeY = enemies[id].y - this.y;
    var range = Math.sqrt(rangeX * rangeX + rangeY * rangeY);
    if (range > this.shotRange) {delete enemies[id];}
	}

  //Bullet
	this.bullets.unshift({
		start : {x:this.x, y:this.y},
		end   : {x:this.x, y:this.y},
		fade  : 1
	});

	var dx = Math.cos(this.angleGun) * this.shotRange;
	var dy = Math.sin(this.angleGun) * this.shotRange;
  var magnitude = Math.sqrt(dx * dx + dy * dy);
  var stepX = dx/magnitude;
  var stepY = dy/magnitude;

  //Bullet step
  for (var i = 0; i < this.shotRange; i++) {
    //Collision
		for (var id in enemies) {
			if (enemies[id].x - tank.radius <= this.bullets[0].end.x && enemies[id].x + tank.radius >= this.bullets[0].end.x
      &&  enemies[id].y - tank.radius <= this.bullets[0].end.y && enemies[id].y + tank.radius >= this.bullets[0].end.y) {
        return id;
      }
		}//for (var id in enemies)
		this.bullets[0].end.x += stepX;
		this.bullets[0].end.y += stepY;
  }//for (var i = 0; i < this.shotRange; i++)

  return false;
};
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
