const Settings = require('./config.json');

var io = require('socket.io').listen(3000);

var mysql      = require('mysql');
var connection = mysql.createConnection({
	host     : Settings.Database.Host,
	user     : Settings.Database.User,
	password : Settings.Database.Password,
	database : Settings.Database.Database
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
	name: Settings.Bot.Name,
	avatar: Settings.Bot.Avatar
}

var UserInfo = function(){
	this.id;
	this.Steam64;
	this.PrivateKey;
	this.name;
	this.avatar;
	this.IsAuth = false;
}

UsersOnline = 0;

io.on('connection', function(socket){

	CUser = new UserInfo();

	UsersOnline++;
	io.emit('update online', UsersOnline);

	socket.emit('message', bot, "Welcome to CSGOAced!");

	socket.emit('auth user');

	socket.on('auth user', function(User){
		connection.query(`SELECT Steam64 FROM Users WHERE ID='${User.id}' AND PrivateKey='${User.PrivateKey}'`, function (error, results, fields) {

			for (var row in results) {
				CUser.id = User.id;
				CUser.Steam64 = results[row].Steam64;
				CUser.PrivateKey = User.PrivateKey;
				CUser.name = User.name;
				CUser.avatar = User.avatar;
				CUser.IsAuth = true;
			}

			if (CUser.IsAuth){
				socket.emit('show place bet');

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

					connection.query(`INSERT INTO ChatHistory (UserID, Message) VALUES ('${user.id}', '${msg}')`, function (error, results, fields) {
						if (error) throw error;
						io.emit('message', user, msg);
					});
				});
			}else{
				socket.on('place bet', function(){
					socket.emit('message', bot, "Login to Place Bets");
				});

				socket.on('join bet', function(){
					socket.emit('message', bot, "Login to Join Bets");
				});

				socket.on('message', function(){
					socket.emit('message', bot, "Login to Send Messages");
				});
			}

			//Display Active Bets
			bets.forEach(function(bet){
				if (!bet.isFinished){
					socket.emit('display bet', bet);
				}
			});
		});
	});

	socket.on('disconnect', function(){
		UsersOnline--;
		io.emit('update online', UsersOnline);
	});
});