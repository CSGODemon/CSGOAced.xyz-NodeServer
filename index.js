var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

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

io.on('connection', function(socket){
	socket.on('PlaceBet', function(BetID){
		socket.emit('FlipCoin', BetID, getSpin(Math.floor(Math.random()*2)));
	});
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});