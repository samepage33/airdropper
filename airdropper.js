#!/usr/bin/env node
if(process.argv.length != 5){
	console.log('Usage: node airdrop.js <filepath>　<from address> <privatekey>');
	process.exit(1);
}

/*Japanese / English / Chinese／
 * 設定ここから/  You can edit from here.／设定从这里开始
 * 前提として/Preparation bufore using this code.／前提
 * ・web3 1.0がインストールされていること(npm install web3)/ Need to finish instal web3 1.0(npm install web3)／必须安装・web3 1.0(npm install web3)
 * ・ethereumjs-txがインストールされていること(npm install ethereumjs-tx)/ Need to finish thereumjs-tx(npm install ethereumjs-tx)／・必须安装ethereumjs-tx(npm install ethereumjs-tx)
 * ・INFURAを使用できること / Require INFURA／需要使用INFURA
 */

//ビルドされたコントラクトのJSONの場所/Path of json file of Contract after finished to build.／JSON构建合同的位置
var contractJSON = '../contract directory/build/contracts/contract.json';
//コントラクトアドレス/Contract address／合约地址
var contractAddress = 'your contract address.';

//既定の送金数(例の場合10Token)/ Default amount of token for sending／汇款数量（例如10Token）
var amount = 10;
//ガス料金（Gwei）/ Gas price(Gwei)／瓦斯费 (Gwei)
var gasPrice = 5;
//ガスリミット/Gas limit／瓦斯上限
var gasLimit = 100000;
//web3プロバイダ/web3 provider／web3 provider
var web3Provider = 'https://mainnet.infura.io/<your api key>';
//chainId(mainnet = 0x1,ropsten = 0x3)
var chainId = "0x1";
/*
 * 設定ここまで/You can edit above. No need to edit at bellow.／设定到此为止
 */


//送金元アドレス(トークンとガス分のETHが有ること)/ the address for sending token with ETH(gas)／汇款来源地址（包含Token和gas）
var fromAddress = process.argv[3];
//送金元のプライベートキー/Private key of fromAddress／汇款来源私钥
var privKey = process.argv[4];


var fs = require('fs');
//送金先アドレス群/List of address for sending.／汇款群地址
var toAddressesFile = process.argv[2];
var toAddresses = [];
//ファイル存在確認/Check availability of file.／确认文件的存在
try {
	fs.statSync(toAddressesFile);
} catch(err){
	console.log('File not found.');
	process.exit(1);
}


const Tx = require('ethereumjs-tx')
var Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(web3Provider))
web3.eth.defaultAccount=web3.eth.accounts[0]

var json = require(contractJSON);
var abi = json.abi;

var contract = new web3.eth.Contract(abi, contractAddress);
const privateKey = new Buffer(privKey, 'hex');

function send_wait(wait){
	if(!wait){
		wait = waitTime;
	}
	console.log('wait ' + wait + 'sec');
	return new Promise(resolve => {
		setTimeout(()=>{
			resolve('wait');
		}, wait * 1000);
	});
}
async function transfer(record){
	var _balance = await web3.eth.getBalance(fromAddress);
	if(_balance < ((gasPrice*1e9) * gasLimit)){
		return new Promise(resolve => {
			resolve('Returned error: low ETH of from address.');
		});		
	}
	var _balance = await contract.methods.balanceOf(fromAddress).call();
	if(_balance < (record.amount * 1e18)){
		return new Promise(resolve => {
			resolve('Returned error: low balance of from address.');
		});
	}
/*
	_balance = await contract.methods.balanceOf(record.address).call();
	var a = _balance;
	if(_balance >= record.amount * 1e18){
		return new Promise(resolve => {
			resolve('Returned error: Already have token.Balance Of token:' + (_balance/1e18).toFixed(3));
		});
	}
*/
	
	const data = contract.methods.transfer(record.address, web3.utils.toHex(record.amount * 1e18)).encodeABI();
	const nonce = await web3.eth.getTransactionCount(fromAddress);
	const nonceHex = '0x' + nonce.toString(16);//web3.utils.toHex(nonce);
	const gasPriceHex = web3.utils.toHex(gasPrice * 1e9);
	const gasLimitHex = web3.utils.toHex(gasLimit);

	 var rawTx = {
	      "from": fromAddress,
	      "nonce": nonceHex,
	      "gasPrice": gasPriceHex,
	      "gasLimit": gasLimitHex,
	      "to": contractAddress,
	      "value": "0x0",
	      "data": data,
	      "chainId": chainId
	};
	var tx = new Tx(rawTx);
	tx.sign(privateKey);
	var serializedTx = tx.serialize();
	

	return new Promise(resolve => {
		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'), function(err, hash) {
			if (!err){
				resolve(hash);	
			} else {
				resolve(err.message);
			}
		});
	});
}

function readFile(){
	return new Promise(resolve => {
		var toAddresses = [];
		var rs = fs.createReadStream(toAddressesFile);
		var readline = require('readline');
		var rl = readline.createInterface(rs, {});
		rl.on('line', function(line){
			var columns = line.split(',');
			if(columns.length == 1){
				columns[1] = amount;
			}
			if(!columns[1]){
				columns[1] = amount;
			}
			toAddresses.push({
				address: columns[0].trim(),
				amount: parseFloat(columns[1]),
				success: 0,
				hash: null
			});
		});
		rl.on('close', function(){
			resolve(toAddresses);
		});
	});
}

function writeFile(toAddress){
	return new Promise(resolve => {
		var data = toAddress.address + "," + toAddress.amount + "," + toAddress.success + "," + toAddress.hash + "\r\n";

		fs.writeFile(toAddressesFile + '.success.csv', data , function (err) {
		    console.log(err);
		    resolve(false);
		});
		resolve(true);
	});
}

async function main(){
	fs.unlink(toAddressesFile + '.success.csv', function (err) {
		if (err) {
			throw err;
		}
	});
	var resultWait;
	var toAddresses = await readFile();
	for(var i = 0;i < toAddresses.length; i++){
		if(web3.utils.isAddress(toAddresses[i].address)){
			var result = await transfer(toAddresses[i]);
			if(!result.match(/Returned error\:/)){
				console.log({success: true, address: toAddresses[i], hash: result});
				toAddresses[i].success = 1;
				toAddresses[i].hash = result;
				writeFile(toAddresses[i]);
				resultWait = await send_wait(10);
			} else {
				if(result.match(/low balance/)){
					console.log({success: false, address: toAddresses[i], message: result});
					process.exit(1);
				} else if(result.match(/Already/)){
					console.log({success: false, address: toAddresses[i], message: result});
					i++;
				} else if(result.match(/known transaction/)){
					console.log({success: false, address: toAddresses[i], message: result});
					resultWait = await send_wait(750);
				} else if(result.match(/within 750/)){
					console.log({success: false, address: toAddresses[i], message: result});
					resultWait = await send_wait(750);
				} else {
					console.log({success: false, address: toAddresses[i], message: result});
					resultWait = await send_wait(60);
				}
				if(i > 0){
					i--;
				}
			}
			if(i % 5 == 0 && i > 0){
				resultWait = await send_wait(60);
			}
		} else {
			console.log('Is not address:' + toAddresses[i]);
		}
	}
}
main();