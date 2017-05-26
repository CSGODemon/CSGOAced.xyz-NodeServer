var io = require('socket.io').listen(3000);

var mysql      = require('mysql');
var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : '',
	database : 'CSGOAced'
});

connection.connect();

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
		if (user.name.length > 0){
			message = new Message(user.avatar, msg);
			messages.push(message);

				connection.query(`INSERT INTO ChatHistory (UserID, Message) VALUES (${user.id}, ${msg})`, function (error, results, fields) {
					if (error) throw error;
					io.emit('message', user, msg);
				});
		}else{
			socket.emit('message', bot, "Login to Send Messages");
		}
		
	});

	socket.on('disconnect', function(){
		UsersOnline--;
		io.emit('update online', UsersOnline);
	});
});