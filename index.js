﻿const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');

const Settings = require('./config.json');
var schedule = require('node-schedule');
var request = require("request");

var io = require('socket.io').listen(3000);

var mysql      = require('mysql');
var connection = mysql.createConnection({
	host     : Settings.Database.Host,
	user     : Settings.Database.User,
	password : Settings.Database.Password,
	database : Settings.Database.Database
});

connection.connect();

connection.query(`INSERT INTO NodeLog (Type, Description) VALUES ("Server", "Start")`);

var bot = {
	name: Settings.Bot.Name,
	avatar: Settings.Bot.Avatar
}

UsersOnline = 0;

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
	steam: client,
	community: community,
	language: 'en'
});

const logOnOptions = {
	accountName: Settings.Bot.accountName,
	password: Settings.Bot.password,
	twoFactorCode: SteamTotp.generateAuthCode(Settings.Bot.sharedSecret)
}

client.logOn(logOnOptions);

io.on('connection', function(socket){

	UsersOnline++;
	io.emit('update online', UsersOnline);

	socket.emit('auth user');

	connection.query(`SELECT Users.Avatar AS Avatar, ChatHistory.Message AS MSG FROM ChatHistory, Users WHERE ChatHistory.UserID = Users.ID ORDER BY ChatHistory.ID DESC LIMIT 8;`, function (error, results, fields) {
		for (row = results.length - 1; row >= 0; row--) {
			socket.emit('message', { avatar: results[row].Avatar, text: results[row].MSG });
		}
	});

	connection.query(`SELECT DISTINCT CoinflipHistory.ID AS ID, Users.Avatar AS Avatar, CoinflipHistory.Ammount AS Ammount FROM CoinflipHistory INNER JOIN Users WHERE CoinflipHistory.IsFinished = 0 AND CoinflipHistory.UserID1 = Users.ID ORDER BY CoinflipHistory.Ammount DESC`, function (error, results, fields) {
		for (var row in results) {
			socket.emit('display bet', {
				id: results[row].ID,
				avatar1: results[row].Avatar,
				ammount: results[row].Ammount,
				isFinished: false
			});
		}
	});

	socket.on('auth user', function(User){
		connection.query(`SELECT Steam64, Name, Avatar, Role FROM Users WHERE ID = ? AND PrivateKey = ? AND PrivateKey IS NOT NULL`, [User.id, User.PrivateKey], function (error, results, fields) {
			var CUser = { IsAuth: false}

			for (var row in results) {
				CUser.id = User.id;
				CUser.Steam64 = results[row].Steam64;
				CUser.name = results[row].Name;
				CUser.avatar = results[row].Avatar;
				CUser.Role = results[row].Role;
				CUser.PrivateKey = User.PrivateKey;
				CUser.IsAuth = true;
			}

			if (CUser.IsAuth && CUser.Role != "Banned"){

				socket.emit('show place bet', CUser.avatar);

				socket.on('reload coins', function(coins){
					connection.query(`SELECT Coins FROM Users WHERE ID = ?`, [CUser.id], function (error, results, fields) {
						for (var row in results) {
							Coins = results[row].Coins;
						}
						if (!isNaN(Coins)){
							socket.emit('update coins', Coins);
						}
					});
				});

				socket.on('place bet', function(ammount){

					if (isNaN(ammount)){
						SendAlert("Invalid Number!", "Please enter a valid Number!", socket);
						return false;
					}

					if (ammount < 50){
						SendAlert("Not Enought Coins!", "Minimum ammount is 50 coins!", socket);
						return false;
					}

					if (ammount > 100000){
						SendAlert("Too Many Coins!", "Maximum ammount is 100000 coins!", socket);
						return false;
					}

					connection.query(`SELECT Coins FROM Users WHERE ID = ?`, [CUser.id], function (error, results, fields) {
						for (var row in results) {
							Coins = results[row].Coins;
						}
						if (isNaN(Coins) || Coins < ammount){
							SendAlert("Not Enought Coins!", "Deposit to get more coins!", socket);
							return false;
						}
						Wallet = (Coins - ammount);
						connection.query(`UPDATE Users SET Coins = ? WHERE ID = ?;`, [Wallet, CUser.id], function (error, results, fields) {
							socket.emit('update coins', Wallet);
							connection.query(`INSERT INTO CoinflipHistory (UserID1, Ammount) VALUES (?, ?);`, [CUser.id, ammount], function (error, results, fields) {
								connection.query(`SELECT MAX(ID) AS ID FROM CoinflipHistory`, function (error, results, fields) {

									BetID = -1;
									for (var row in results) {
										BetID = results[row].ID;
									}
									
									io.emit('display bet', {
										id: BetID,
										avatar1: CUser.avatar,
										ammount: ammount,
										isFinished: false
									});
								});
							});
						});
					});
				});

				socket.on('join bet', function(BetID){
					connection.query(`SELECT CoinflipHistory.ID AS ID, CoinflipHistory.UserID1 AS UID1, CoinflipHistory.Ammount AS Ammount, CoinflipHistory.Fee AS Fee, Users.Avatar AS Avatar FROM CoinflipHistory INNER JOIN Users WHERE CoinflipHistory.IsFinished = 0 AND CoinflipHistory.UserID1 = Users.ID AND CoinflipHistory.ID = ?`, [BetID], function (error, results, fields) {
						for (var row in results) {
							if (results[row].ID == BetID){
								if (results[row].UID1 != CUser.id){

									BetAmmount = results[row].Ammount;
									Ammount = results[row].Ammount * 2;
									Fee = parseInt(Ammount * Settings.Coinflip.Fee);
									Ammount -= Fee;

									Winner = Math.floor(Math.random()*2);

									WinnerUID = (Winner == 1) ? results[row].UID1 : CUser.id;
									Avatar = results[row].Avatar;

									connection.query(`SELECT Coins FROM Users WHERE ID = ?`, [CUser.id], function (error, results, fields) {
										for (var row in results) {
											Coins = results[row].Coins;
										}
										if (isNaN(Coins) || Coins < BetAmmount){
											SendAlert("Not Enought Coins!", "Deposit to get more coins!", socket);
											return false;
										}

										socket.emit('update coins', (Coins - BetAmmount));
										connection.query(`UPDATE Users SET Coins = (SELECT (Select Coins) - ?) WHERE ID = ?;`, [BetAmmount, CUser.id], function (error, results, fields) {
											connection.query(`UPDATE CoinflipHistory SET UserID2 = ?, Ammount = ?, Fee = ?, IsFinished = 1 WHERE ID = ?;`, [CUser.id, Ammount, Fee, BetID], function (error, results, fields) {
												connection.query(`INSERT INTO CoinflipResultHistory (CoinflipID, WinnerID) VALUES (?, ?);`, [BetID, WinnerUID], function (error, results, fields) {
													connection.query(`UPDATE Users SET Coins = (SELECT (Select Coins) + ?) WHERE ID = ?;`, [Ammount, WinnerUID], function (error, results, fields) {
														io.emit('flip', {
															id: BetID,
															avatar1: Avatar,
															avatar2: CUser.avatar,
															ammount: Ammount,
															winner: Winner,
															winnerUID: WinnerUID,
															isFinished: true
														});
													});
												});
											});
										});
									});
								}else{
									SendAlert("Bet Error", "<span class='glyphicon glyphicon-remove'></span> Can't place a bet against yourself", socket);
								}
								return false;
							}
						}
					});
				});

				socket.on('coinflip history', function(){
					connection.query(`SELECT DISTINCT CoinflipHistory.ID AS ID, (CASE WHEN CoinflipResultHistory.WinnerID = ? THEN 1 ELSE 0 END) AS Won, (CoinflipHistory.Ammount + CoinflipHistory.Fee) AS Ammount, CoinflipHistory.CreateTimestamp AS CreateTimestamp FROM CoinflipHistory INNER JOIN CoinflipResultHistory INNER JOIN Users WHERE CoinflipHistory.IsFinished = 1 AND CoinflipHistory.UserID1 = Users.ID AND CoinflipHistory.ID = CoinflipResultHistory.CoinflipID AND (CoinflipHistory.UserID1 = ? OR CoinflipHistory.UserID2 = ?) ORDER BY CoinflipHistory.ID DESC;`, [User.id, User.id, User.id] , function (error, results, fields) {
						socket.emit('coinflip history', results);
					});
				});

				socket.on('freecoins', function(){
					connection.query(`SELECT RefCode FROM Users WHERE ID = ?`, [User.id], function (error, results, fields) {
						socket.emit('freecoins', (!results[0].RefCode) ? "Your Code!" : results[0].RefCode);
					});
				});

				socket.on('referal', function(refcode){
					if(!refcode || refcode.length > 7){
						SendAlert('Invalid Referal Code', 'Maximum Referal Code Length is 7 Characters', socket);
						return false;
					}
					
					refcode = refcode.toLowerCase();

					connection.query(`SELECT count(*) AS Repeated FROM Users WHERE RefCode = ? AND ID <> ?`, [refcode, CUser.id], function (error, results, fields) {
						if (results[0].Repeated == 0){
							connection.query(`UPDATE Users SET RefCode = ? WHERE ID = ?`, [refcode, CUser.id], function (error, results, fields) {
								connection.query(`INSERT INTO RefCodeHistory (UserID, RefCode) VALUES (?, ?)`, [CUser.id, refcode], function (error, results, fields) {
									SendSuccess("Referal Code", "Your Referal Code Was Sucessfully Updated", socket);
								});
							});
						}else{
							SendAlert("Duplicate Code", "This Referal Code is Already in Use", socket);
						}
					});
				});

				socket.on('trade_url', function(trade_url){
					if(!trade_url || trade_url.length > 80 || !(/steamcommunity\.com\/tradeoffer\/new\/\?partner=[0-9]*&token=[a-zA-Z0-9_-]*/i.exec(trade_url))){
						SendAlert('Invalid Trade URL', 'Provide a valid Trade URL', socket);
						return false;
					}

					connection.query(`UPDATE Users SET Trade_URL = ? WHERE ID = ?;`, [trade_url, CUser.id], function (error, results, fields) {
						SendSuccess("Trade URL", "Your Trade URL Was Sucessfully Updated", socket);
						connection.query(`INSERT INTO TradeURLHistory (UserID, Trade_URL) VALUES (?, ?)`, [CUser.id, trade_url]);
					});
				});

				socket.on('message', function(msg){
					if (msg.length > 50){
						SendAlert("Message Lenght", "You can only write 50 characters", socket);
						return false;
					}

					msg = msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");

					connection.query(`INSERT INTO ChatHistory (UserID, Message) VALUES (?, ?)`, [CUser.id, msg], function (error, results, fields) {
						io.emit('message', { avatar: CUser.avatar, text: msg });
					});
				});

				socket.on('deposit', function(items){
					SendOffer(CUser.id, items, true, socket);
				});

				socket.on('withdraw', function(items){
					connection.query(`SELECT (SELECT SUM(Ammount + Fee) FROM CoinflipHistory WHERE (UserID1 = ? OR UserID2 = ?) AND IsFinished = 1) AS TotalBetted, (SELECT SUM(TransactionItems.Coins) FROM TransactionItems INNER JOIN Transactions WHERE TransactionItems.TransactionID = Transactions.ID AND Transactions.Type = "Deposit" AND Transactions.UID = ? AND Transactions.Status = 3) AS TotalDeposited`, [User.id, User.id, User.id, User.id], function (error, results, fields) {
						var total_deposited = results[0].TotalDeposited;
						var total_betted = results[0].TotalBetted;

						if(!total_deposited || total_deposited < 500){
							SendAlert("Unable to Withdraw", "You must deposit 500 coins before withdraw", socket);
							return false;
						}

						if(!total_betted || total_betted < 1000){
							SendAlert("Unable to Withdraw", "You must bet 500 coins before withdraw", socket);
							return false;
						}

						SendOffer(CUser.id, items, false, socket);
					});
				});
			}else if (CUser.Role == "Banned"){
				SendAlert("Permanent Ban!", "You Have Been Permanently Banned from CSGOAced.xyz.", socket);
			}else{
				socket.on('place bet', function(){
					SendAlert("No Login", "Login to Place Bets", socket);
				});

				socket.on('join bet', function(){
					SendAlert("No Login", "Login to Join Bets", socket);
				});

				socket.on('message', function(){
					SendAlert("No Login", "Login to Send Messages!", socket);
				});
			}
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

function SendAlert(Title, Content, socket){
	socket.emit('alert', {
		closeIcon: true,
		closeIconClass: 'fa fa-close',
		backgroundDismiss: true,
		title: Title,
		content: Content,
		animation: 'RotateXR',
		closeAnimation: 'RotateXR',
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

function SendSuccess(Title, Content, socket){
	socket.emit('alert', {
		closeIcon: true,
		closeIconClass: 'fa fa-close',
		backgroundDismiss: true,
		title: Title,
		content: Content,
		animation: 'RotateXR',
		closeAnimation: 'RotateXR',
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

client.on('loggedOn', () => {
	connection.query(`INSERT INTO NodeLog (Type, Description) VALUES ("Steam", "Login")`);
});

client.on('webSession', (sessionid, cookies) => {
	manager.setCookies(cookies);

	community.setCookies(cookies);
	community.startConfirmationChecker(10000, Settings.Bot.identitySecret);
});

function SendOffer(UID, items, isDeposit, socket) {
	if (items.length == 0){
		SendAlert('No selected items', 'Add items to your cart!', socket);
		return false;
	}

	connection.query(`SELECT Trade_URL, Steam64, Coins FROM Users WHERE ID = ?`, [UID], function (error, results, fields) {
		var Wallet = results[0].Coins;
		var steam64 = results[0].Steam64;
		var Trade_URL = results[0].Trade_URL;

		if(!Trade_URL || Trade_URL.length > 80 || !(/steamcommunity\.com\/tradeoffer\/new\/\?partner=[0-9]*&token=[a-zA-Z0-9_-]*/i.exec(Trade_URL))){
			socket.emit('tradeurl');
			return false;
		}

		const partner = steam64;
		const appid = 730;
		const contextid = 2;

		const offer = manager.createOffer(Trade_URL);

		if (isDeposit == true){
			manager.loadUserInventory(partner, appid, contextid, true, (err, theirInv) => {
				if (err) {
					connection.query(`INSERT INTO NodeLog (Type, Description) VALUES ("Steam", ?)`, ["Error Loading Inventory: " + err]);
				} else {

					var i = 0;

					for (var item in items){
						for (var theirItem in theirInv){
							if (theirInv[theirItem].classid == items[item].classID && theirInv[theirItem].assetid == items[item].assetID){
								offer.addTheirItem(theirInv[theirItem]);
								i++;
							}
						}
					}

					if (i != items.length){
						SendAlert("Error", "Some items may not be avaliable now. <br />Please Refresh Your Inventory!", socket);
						return false;
					}

					SendTradeOffer(offer, UID, "Deposit", items, socket);
				}
			});
		}
		else
		{
			var Total = 0;

			i2 = 0;
			for (i = 0; i < items.length; i++){
				connection.query(`SELECT SellPrice FROM SkinPrices WHERE SkinMarketName = ?`, [items[i].market_name], function (error, results, fields) {
					i2++;
					Total += results[0].SellPrice;
					if (i2 == items.length){
						if (Total > Wallet){
							SendAlert("Error", "You don't have enought coins!", socket);
							return;
						}

						manager.loadInventory(appid, contextid, true, (err, myInv) => {
							if (err) {
								connection.query(`INSERT INTO NodeLog (Type, Description) VALUES ("Steam", ?)`, ["Error Loading Inventory: " + err], function (error, results, fields) { });
							} else {

								var i = 0;

								for (var item in items){
									for (var myItem in myInv){
										if (myInv[myItem].classid == items[item].classID && myInv[myItem].assetid == items[item].assetID){
											offer.addMyItem(myInv[myItem]);
											i++;
										}
									}
								}

								if (i != items.length){
									SendAlert("Error", "Some items may not be avaliable now. <br />Please Refresh Bot's Inventory!", socket);
									return false;
								}

								SendTradeOffer(offer, UID, "Withdraw", items, socket, Total);
							}
						});
					}
				});
			}
		}
	});
}

manager.on('newOffer', (offer) => {
	if (offer.partner.getSteamID64() == Settings.Bot.admin) {
		offer.accept((err, status) => {
			if (err) {
				connection.query(`INSERT INTO NodeLog (Type, Description) VALUES ("Steam", ?)`, ["Error Accepting Offer (" + offer.id + ") From Admin: " + err]);
			} else {
				connection.query(`INSERT INTO NodeLog (Type, Description) VALUES ("Steam", ?)`, ["Accepted Offer From Admin: " + offer.id]);
			}
		});
	}else{
		offer.decline();
	}
});

manager.on('sentOfferChanged', (offer, oldState) => {
	connection.query(`UPDATE Transactions SET Status = ? WHERE OfferID = ?`, [offer.state, offer.id], function (error, results, fields) {
		if ((offer.state == 3 && offer.itemsToReceive.length > 0) || ((offer.state == 8 || offer.state == 7)  && offer.itemsToGive.length > 0)){
			connection.query(`UPDATE Users SET Coins = (SELECT (SELECT SUM(Coins) FROM TransactionItems WHERE TransactionID = (SELECT ID FROM Transactions WHERE Transactions.OfferID = ?)) + (SELECT Coins WHERE ID = (SELECT UID FROM Transactions WHERE Transactions.OfferID = ?))) WHERE ID = (SELECT UID FROM Transactions WHERE Transactions.OfferID = ?)`, [offer.id, offer.id, offer.id]);
		}
	});
});

function SendTradeOffer(offer, UID, TransactionType, items, socket, Total){
	offer.getUserDetails((err, me, them) => {
		if(err){
			SendAlert("Error Sending Trade Offer", err.message, socket);
			return;	
		}

		if(them.escrowDays > 0) {
			SendAlert("No Steam Mobile Authenticator", "You must enable Steam Mobile Authenticator Before " + TransactionType , socket);
			offer.cancel();
		}

		const code = Math.floor(Math.random() * 1000 + 1000);
		offer.setMessage(`Where's your security code: ${code}`);

		offer.send((err, status) => {
			if (err) {
				connection.query(`INSERT INTO NodeLog (Type, Description) VALUES ("Steam", ?)`, ["Error Loading Inventory: " + err]);
				SendAlert("Error", "Error Sending Trade Offer!", socket);
			}
			SendSuccess("Sucess", "Trade Offer Successfully Sent. <br /> Trade code: " + code, socket);
			connection.query(`INSERT INTO Transactions (Type, UID, OfferID, Status) VALUES (?, ?, ?, ?)`, [TransactionType, UID, offer.id, offer.state], function (error, results, fields) {
				for (var item in items){
					if (TransactionType == "Deposit"){
						connection.query(`INSERT INTO TransactionItems (TransactionID, SkinMarketName, AssetID, ClassID, Coins) VALUES ((SELECT ID FROM Transactions WHERE OfferID = ?), ?, ?, ?, (SELECT BuyPrice FROM SkinPrices WHERE SkinMarketName = ?))`, [offer.id, items[item].market_name, items[item].assetID, items[item].classID, items[item].market_name]);
					}else{
						connection.query(`INSERT INTO TransactionItems (TransactionID, SkinMarketName, AssetID, ClassID, Coins) VALUES ((SELECT ID FROM Transactions WHERE OfferID = ?), ?, ?, ?, (SELECT SellPrice FROM SkinPrices WHERE SkinMarketName = ?))`, [offer.id, items[item].market_name, items[item].assetID, items[item].classID, items[item].market_name]);
					}
				}
				if (TransactionType == "Withdraw"){
					connection.query(`UPDATE Users SET Coins = (SELECT (Select Coins) - ?) WHERE ID = ?;`, [Total, UID]);
				}
			});
		});
	});
}

var RefreshPrices = schedule.scheduleJob(Settings.Bot.RefreshPricelist, function(){
	request({
		url: "https://api.csgofast.com/price/all",
		json: true
	}, function (error, response, body) {
		if (!error && response.statusCode === 200) {

			connection.query(`TRUNCATE TABLE SkinPrices;`);

			for (var skin in body){
				connection.query(  `IF NOT EXISTS(SELECT MarketName FROM Skins WHERE MarketName = ?)
									THEN
										INSERT INTO Skins (MarketName) VALUES (?);
									END IF;`,[skin, skin]);

				var BuyPrice = body[skin] * Settings.Price.BuyMultiplier + Settings.Price.BuyGap;
				var SellPrice = body[skin] * Settings.Price.SellMultiplier + Settings.Price.SellGap;

				connection.query(`INSERT INTO SkinPrices (SkinMarketName, BuyPrice, SellPrice) VALUES (?, ?, ?);`, [skin, BuyPrice, SellPrice]);
			}
			connection.query(`INSERT INTO RefreshPriceHistory (UserID) VALUES (1)`);
		}
	})
});