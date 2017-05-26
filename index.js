var io = require('socket.io').listen(3000);

var bets = [];
var messages = [];

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

var Message = function(avatar, msg) {
	this.avatar = avatar;
	this.msg = msg;
}

var bot = {
	name: "CSGOAced.xyz Bot",
	avatar:"https://www.csgoaced.xyz/img/icon.png"
}

UsersOnline = 0;

var name1 = "Onireves";
var name2 = "SuperBlackdino";
var ammout = 900;
var avatar1 = "https://www.csgoaced.xyz/img/avatar1.jpg";
var avatar2 = "https://www.csgoaced.xyz/img/avatar2.jpg";

bets.push(new Bet(name1, avatar1, ammout));
bets.push(new Bet(name2, avatar2, ammout));
bets.push(new Bet(name1, avatar1, ammout));
bets.push(new Bet(name2, avatar2, ammout));
bets.push(new Bet(name1, avatar1, ammout));
bets.push(new Bet(name2, avatar2, ammout));
bets.push(new Bet(name1, avatar1, ammout));
bets.push(new Bet(name2, avatar2, ammout));
bets.push(new Bet(name1, avatar1, ammout));
bets.push(new Bet(name2, avatar2, ammout));

io.on('connection', function(socket){
	UsersOnline++;
	io.emit('update online', UsersOnline);

	socket.emit('show place bet');
	socket.emit('message', bot, "Welcome to CSGOAced!");

	//Display Active Bets
	bets.forEach(function(bet){
		if (!bet.isFinished){
			socket.emit('display bet', bet);
		}
	});

	socket.on('place bet', function(MyBet){
		if (isNaN(MyBet.ammount)){ return false; }

		var bet = new Bet(MyBet.name, MyBet.avatar, MyBet.ammount);
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

	socket.on('message', function(user, msg){
		message = new Message(user.avatar, msg);
		messages.push(message);

		io.emit('message', user, msg);
	});

	socket.on('disconnect', function(){
		UsersOnline--;
		io.emit('update online', UsersOnline);
	});
});