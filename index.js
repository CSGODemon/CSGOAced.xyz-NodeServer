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

var Bet = function(UID, avatar, ammount){
	this.id = bets.length;
	this.UID1 = UID;
	this.UID2;
	this.avatar1 = avatar;
	this.avatar2;
	this.ammount = ammount;
	this.winner = Math.floor(Math.random()*2);
	this.isFinished = false;
}

var bot = {
	name: Settings.Bot.Name,
	avatar: Settings.Bot.Avatar
}

UsersOnline = 0;

io.on('connection', function(socket){

	UsersOnline++;
	io.emit('update online', UsersOnline);

	BotMSG("Welcome To CSGOAced!");

	socket.emit('auth user');

	socket.on('auth user', function(User){
		connection.query(`SELECT Steam64 FROM Users WHERE ID='${User.id}' AND PrivateKey='${User.PrivateKey}'`, function (error, results, fields) {

			var CUser = { IsAuth: false}

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

				socket.on('place bet', function(ammount){

					if (isNaN(ammount)){ return false; }

					var bet = new Bet(CUser.id, CUser.avatar, ammount);
					bets.push(bet);
					io.emit('display bet', bet);
				});

				socket.on('join bet', function(BetID){
					bets.forEach(function(bet){
						if (!bet.isFinished){
							if (bet.id == BetID){
								if (bet.UID1 != CUser.id){
									bet.avatar2 = CUser.avatar;
									bet.UID2 = CUser.id;
									bet.ammount *= 2;
									bet.isFinished =  true;

									io.emit('flip', bet);
								}
								return false;
							}
						}
					});
				});

				socket.on('message', function(msg){

					connection.query(`INSERT INTO ChatHistory (UserID, Message) VALUES ('${CUser.id}', '${msg}')`, function (error, results, fields) {
						if (error) throw error;
						io.emit('message', { avatar: CUser.avatar, text: msg });
					});
				});
			}else{
				socket.on('place bet', function(){
					BotMSG("Login to Place Bets");
				});

				socket.on('join bet', function(){
					BotMSG("Login to Join Bets");
				});

				socket.on('message', function(){
					BotMSG("Login to Send Messages");
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

	function BotMSG(msg){
		socket.emit('message', { avatar: bot.avatar, text: msg });
	}
});