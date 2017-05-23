var io = require('socket.io').listen(3000);

var bets = [];

var Bet = function(name1, name2, avatar1, avatar2, ammount){
	this.id = bets.length;
	this.name1 = name1;
	this.name2 = name2;
	this.avatar1 = avatar1;
	this.avatar2 = avatar2;
	this.ammount = ammount;
	this.winner = Math.floor(Math.random()*2);
	this.isFinished = false;
}

var name1 = "Onireves";
var name2 = "SuperBlackdino";
var ammout = 900;
var avatar1 = "https://www.csgoaced.xyz/img/avatar1.jpg";
var avatar2 = "https://www.csgoaced.xyz/img/avatar2.jpg";

bets.push(new Bet(name1, name2, avatar1, avatar2, ammout));
bets.push(new Bet(name2, name1, avatar2, avatar1, ammout));

io.on('connection', function(socket){
	socket.emit('show place bet');

	//Display Active Bets
	bets.forEach(function(bet){
		if (!bet.isFinished){
			socket.emit('display bet', bet);
		}
	});

	socket.on('place bet', function(User){
		var bet = new Bet(User.name, name2, User.avatar, avatar2, ammout);
		bets.push(bet);
		io.emit('display bet', bet);
	});

	socket.on('join bet', function(BetID){
		bets.forEach(function(bet){
			if (!bet.isFinished){
				if (bet.id == BetID){
					io.emit('flip', bet);
					bet.isFinished =  true;
				}
			}
		});
	});
});
