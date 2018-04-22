#!/usr/bin/env node
if(process.argv.length != 5){
	console.log('Usage: node airdrop.js <filepath>　<from address> <privatekey>');
	process.exit(1);
}

/*Japanese / English 
 * 設定ここから/  You can edit from here.
 * 前提として/Preparation bufore using this code.
 * ・web3 1.0がインストールされていること(npm install web3)/ Need to finish instal web3 1.0(npm install web3)
 * ・ethereumjs-txがインストールされていること(npm install ethereumjs-tx)/ Need to finish thereumjs-tx(npm install ethereumjs-tx)
 * ・INFURAを使用できること / Require INFURA
 */

//ビルドされたコントラクトのJSONの場所/Path of json file of Contract after finished to build.
var contractJSON = '../contract directory/build/contracts/contract.json';
//コントラクトアドレス/Contract address
var contractAddress = 'your contract address.';

//送金数(例の場合33Token)/ Amount of token for sending
var amount = 10;
//ガス料金（Gwei）/ Gas price(Gwei)
var gasPrice = 2;
//ガスリミット/Gas limit
var gasLimit = 6100500;
//web3プロバイダ/web3 provider
var web3Provider = 'https://mainnet.infura.io/<your api key>';
//chainId(mainnet = 0x1,ropsten = 0x3)
var chainId = "0x1";
/*
 * 設定ここまで/You can edit above. No need to edit at bellow.
 */


//送金元アドレス(トークンとガス分のETHが有ること)/ the address for sending token with ETH(gas)
var fromAddress = process.argv[3];
//送金元のプライベートキー/Private key of fromAddress
var privKey = process.argv[4];


var fs = require('fs');
//送金先アドレス群
var toAddressesFile = process.argv[2];
var toAddresses = [];
//ファイル存在確認
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
async function transfer(address){
	var _balance = await contract.methods.balanceOf(fromAddress).call();
	if(_balance < (amount * 1e18)){
		return new Promise(resolve => {
			resolve('Returned error: low balance of from address.');
		});
	}
	_balance = await contract.methods.balanceOf(address).call();
	var a = _balance;
	if(_balance >= amount * 1e18){
		return new Promise(resolve => {
			resolve('Returned error: Already have token.Balance Of token:' + (_balance/1e18).toFixed(3));
		});
	}
	
	const data = contract.methods.transfer(address, amount * 1e18).encodeABI();
	const nonce = await web3.eth.getTransactionCount(fromAddress);
	const nonceHex = web3.utils.toHex(nonce);
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
			toAddresses.push(line.trim());
		});
		rl.on('close', function(){
			resolve(toAddresses);
		});
	});
}
async function main(){
	var resultWait;
	var toAddresses = await readFile();
	for(var i = 0;i < toAddresses.length; i++){
		if(web3.utils.isAddress(toAddresses[i])){
			var result = await transfer(toAddresses[i]);
			if(!result.match(/Returned error\:/)){
				console.log({success: true, address: toAddresses[i], hash: result});
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
				resultWait = await send_wait(1200);
			}
		} else {
			console.log('Is not address:' + toAddresses[i]);
		}
	}
}
main();