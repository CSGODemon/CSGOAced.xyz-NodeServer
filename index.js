var fs = require( 'fs' );
var app = require('express')();
var httpsOptions = { 
	key: fs.readFileSync('certificates/server.key'), 
	cert: fs.readFileSync('certificates/final.crt')
};        

var secureServer = require('https').createServer(httpsOptions, app);

io = require('socket.io').listen(
	secureServer,{
		pingTimeout: 7000, 
		pingInterval: 10000
	}
);

io.set(
	"transports", [
		"xhr-polling",
		"websocket",
		"polling", 
		"htmlfile"]
);

secureServer.listen(3000, function(){
	console.log('Listening on *:3000');
});

//Coin Flip
var player1 = ['animation1080','animation1440','animation1800','animation2160'];
var player2 =['animation900','animation1260','animation1620','animation1980'];

function getSpin(player) {
	if (player == 1){
		return player1[Math.floor(Math.random()*player1.length)];
	}else{
		return player2[Math.floor(Math.random()*player2.length)];
	}
}

var bets = [];

var bet = function(name, avatar1, avatar2, ammount){
	this.id = bets.length;
	this.name = name;
	this.avatar1 = avatar1;
	this.avatar2 = avatar2;
	this.ammount = ammount;
}

bets.push(new bet("Onireves", "http://www.csgoaced.xyz/img/avatar1.jpg", "http://www.csgoaced.xyz/img/avatar2.jpg", 500));
bets.push(new bet("SuperBlackdino", "http://www.csgoaced.xyz/img/avatar2.jpg", "http://www.csgoaced.xyz/img/avatar1.jpg", 999));

io.on('connection', function(socket){
	socket.on('PlaceBet', function(BetID){
		socket.emit('FlipCoin', BetID, getSpin(Math.floor(Math.random()*2)));
	});

	socket.emit('DisplayBets', bets);
});