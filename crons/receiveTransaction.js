var ethers = require("ethers");
var config = require('../config/config');

// WEBSOCKET URL
var url = "wss://ropsten.infura.io/ws/v3/a478bf40f7b24494b30b082c0d225104";

// PROVIDER
var provider = new ethers.providers.WebSocketProvider(url);

let transactionsToAdd = []
let pendingTokenTransactions = [];
let blocksToCheck = [];
let latestBlock;
let lastCheckedBlock;
let initialBlock = config.receiveCron.initialBlock == '0' ? 'latest' : config.receiveCron.initialBlock;

var init = async () => {
  
    // EVENT LISTENING WHEN NEW BLOCKS MINED
    provider.on("block", async (tx) => {
    console.log("TX::",tx)

    if (latestBlock == undefined) {
        latestBlock = await provider.getBlock(initialBlock);
        console.log("LATEST BLOCK::",latestBlock);
        blocksToCheck.push(latestBlock);
        lastCheckedBlock = (latestBlock.number - 1);
    }

    latestBlock = await provider.getBlock(Number(latestBlock.number) + 1);

    if (latestBlock == null) {
        latestBlock = await provider.getBlock(lastCheckedBlock);
        console.log("LATEST BLOCK::",latestBlock);
    } else {
        console.log('LATEST PENDING BLOCK:: ', latestBlock.number)
        blocksToCheck.push(latestBlock)
        // checkBlocks()
    }
    // provider.getTransaction(tx).then(function (transaction) {
    //   console.log(transaction);
    // });
  });

  provider._websocket.on("error", async () => {
    console.log(`Unable to connect to ${ep.subdomain} retrying in 3s...`);
    setTimeout(init, 3000);
  });
  
  provider._websocket.on("close", async (code) => {
    console.log(
      `Connection lost with code ${code}! Attempting reconnect in 3s...`
    );
    provider._websocket.terminate();
    setTimeout(init, 3000);
  });

};

init();