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

var BetID = 0;

var Bet = function(UID, avatar, ammount){
	this.id = BetID;

	BetID++;

	this.UID1 = UID;
	this.UID2;
	this.avatar1 = avatar;
	this.avatar2;
	this.ammount = ammount;
	this.winner;
	this.winnerUID;
	this.fee;
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
					for (var i in bets){
						var bet = bets[i];
						if (!bet.isFinished){
							if (bet.id == BetID){
								if (bet.UID1 != CUser.id){
									bet.avatar2 = CUser.avatar;
									bet.UID2 = CUser.id;

									bet.ammount *= 2;
									bet.fee = parseInt(bet.ammount * Settings.Coinflip.Fee);
									bet.ammount -= bet.fee;

									bet.winner = Math.floor(Math.random()*2);

									bet.winnerUID = (bet.winner == 1) ? bet.UID1 : bet.UID2;

									bet.isFinished =  true;

									connection.query(`INSERT INTO CoinflipHistory (UserID, Ammount, Fee) VALUES ('${bet.winnerUID}', '${bet.ammount}', '${bet.fee}');`, function (error, results, fields) {
										io.emit('flip', bet);
									});

									bets.splice(i, 1);
								}else{
									SendAlert("Bet Error", "Can't place a bet against yourself!");
								}
								return false;
							}
						}
					}
				});

				socket.on('coinflip history', function(){
					connection.query(`SELECT ID, Ammount, CreateTimestamp FROM CoinflipHistory WHERE UserID='${User.id}'`, function (error, results, fields) {
						socket.emit('coinflip history', results);
					});
				});

				socket.on('freecoins', function(){
					connection.query(`SELECT RefCode FROM Users WHERE ID='${User.id}'`, function (error, results, fields) {
						socket.emit('freecoins', (!results[0].RefCode) ? "Your Code!" : results[0].RefCode);
					});
				});

				socket.on('referal', function(refcode){
					connection.query(`UPDATE Users SET RefCode = '${refcode}' WHERE ID = ${CUser.id};`, function (error, results, fields) {
						if (error) throw error;
						SendSuccess("Referal Code", "Your Referal Code Was Sucessfully Updated");
					});
				});

				socket.on('trade_url', function(trade_url){
					connection.query(`UPDATE Users SET Trade_URL = '${trade_url}' WHERE ID = ${CUser.id};`, function (error, results, fields) {
						if (error) throw error;
						SendSuccess("Trade URL", "Your Trade URL Was Sucessfully Updated");
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
					SendAlert("No Login", "Login to Place Bets");
				});

				socket.on('join bet', function(){
					SendAlert("No Login", "Login to Join Bets");
				});

				socket.on('message', function(){
					SendAlert("No Login", "Login to Send Messages!");
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

	function SendAlert(Title, Content){
		socket.emit('alert', {
			closeIcon: true,
			closeIconClass: 'fa fa-close',
			backgroundDismiss: true,
			title: Title,
			content: Content,
			buttons: {
				ok: {
					btnClass: 'btn-red',
					keys: ['enter'],
					action: function(){
					}
				}
			}
		});
	}

	function SendSuccess(Title, Content){
		socket.emit('alert', {
			closeIcon: true,
			closeIconClass: 'fa fa-close',
			backgroundDismiss: true,
			title: Title,
			content: Content,
			buttons: {
				ok: {
					btnClass: 'btn-green',
					keys: ['enter'],
					action: function(){
					}
				}
			}
		});
	}
});