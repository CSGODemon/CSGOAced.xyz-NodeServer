var io = require('socket.io').listen(3000);

var bets = [];

var Bet = function(name, avatar, ammount){
	this.id = bets.length;
	this.name1 = name;
	this.name2 = "";
	this.avatar1 = avatar;
	this.avatar2 = "";
	this.ammount = ammount;
	this.winner = Math.floor(Math.random()*2);
	this.isFinished = false;
}

var name1 = "Onireves";
var name2 = "SuperBlackdino";
var ammout = 900;
var avatar1 = "https://www.csgoaced.xyz/img/avatar1.jpg";
var avatar2 = "https://www.csgoaced.xyz/img/avatar2.jpg";

bets.push(new Bet(name1, avatar1, ammout));
bets.push(new Bet(name2, avatar2, ammout));

io.on('connection', function(socket){
	socket.emit('show place bet');

	//Display Active Bets
	bets.forEach(function(bet){
		if (!bet.isFinished){
			socket.emit('display bet', bet);
		}
	});

	socket.on('place bet', function(User){
		var bet = new Bet(User.name, User.avatar, ammout);
		bets.push(bet);
		io.emit('display bet', bet);
	});

	socket.on('join bet', function(MyBet){
		bets.forEach(function(bet){
			if (!bet.isFinished){
				if (bet.id == MyBet.id){

					bet.avatar2 = MyBet.avatar;
					bet.name2 = MyBet.name;
					bet.ammount *= 2;
					bet.isFinished =  true;

					io.emit('flip', bet);
				}
			}
		});
	});
});