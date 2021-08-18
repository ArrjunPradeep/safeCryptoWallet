var ethers = require("ethers");
var config = require("../config/config");
const mongoose = require("mongoose");
const constants = require("../constants/constants");
const walletsModel = require("../models/wallets");
const transactionsModel = require("../models/transactions");

mongoose
  .connect(
    "mongodb://" +
      config.db.userName +
      ":" +
      config.db.password +
      "@" +
      config.db.host +
      ":" +
      config.db.port +
      "/" +
      config.db.dbName
  )
  .then(() => {
    // var provider = new ethers.providers.WebSocketProvider(url);
    // getWalletAddress();
    init();
  });

// WEBSOCKET URL
var url = "wss://ropsten.infura.io/ws/v3/a478bf40f7b24494b30b082c0d225104";
// var url = "wss://bsc.getblock.io/testnet/?api_key=c3c3dca1-f735-4463-9b14-f108b37f942a";

// PROVIDER
var provider = new ethers.providers.WebSocketProvider(url);
console.log(provider.getBalance("0xa83ad9b5689d100455f47304e116b46feAd3690A"));

let transactionsToAdd = [];
let pendingTokenTransactions = [];
let blocksToCheck = [];
let latestBlock;
let lastCheckedBlock;
let initialBlock =
  config.receiveCron.initialBlock == "0"
    ? "latest"
    : config.receiveCron.initialBlock;
let isRunning = false;

var init = async () => {
  // EVENT LISTENING WHEN NEW BLOCKS MINED
  provider.on("block", async (tx) => {
    console.log("TX::", tx);

    if (latestBlock == undefined) {
      latestBlock = await provider.getBlock(initialBlock);
      console.log("LATEST BLOCK::", latestBlock.number);
      blocksToCheck.push(latestBlock);
      lastCheckedBlock = latestBlock.number - 1;
    }

    latestBlock = await provider.getBlock(Number(latestBlock.number) + 1);

    if (latestBlock == null) {
      latestBlock = await provider.getBlock(lastCheckedBlock);
      console.log("LATEST BLOCK::", latestBlock.number);
    } else {
      console.log("LATEST PENDING BLOCK:: ", latestBlock.number);
      blocksToCheck.push(latestBlock);
      // checkBlocks()
    }
    // provider.getTransaction(tx).then(function (transaction) {
    //   console.log(transaction);
    // });
  });

  setInterval(() => {
    if (isRunning == false) {
      checkBlocks();
    }
  }, 15000);

  // const wait = (timeToDelay) => new Promise((resolve) => setTimeout(resolve, timeToDelay));

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

const checkBlocks = async () => {
  try {
    while (blocksToCheck.length > 0) {
      isRunning = true;

      let block = blocksToCheck[0];

      console.log("BLOCK::", block);

      if (Number(block.number) <= Number(lastCheckedBlock)) {
        blocksToCheck.shift();

        break;
      } else if (Number(block.number) > Number(lastCheckedBlock)) {
        blocksToCheck.shift();

        console.log(":: CHECKING BLOCK ::", block.number);

        lastCheckedBlock = block.number;

        console.log(":: BLOCK TRANSACTIONS ::", block.transactions.length);

        await block.transactions.forEach(async (hash) => {
          let txn = await provider.getTransaction(hash);

          console.log("RX", txn);

          let wallets = await getWalletAddress();

          let txFromDb = await transactionsModel
            .findOne({ hash: hash })
            .lean()
            .exec();

          console.log(":: TRANSACTION FROM DB ::", txFromDb);

          if (wallets.indexOf(txn.to >= 0)) {
            // COIN TRANSACTIONS

            console.log(":: BNB TRANSACTION ::");

            transactionsToAdd.push(txn);

            // ADD COIN TRANSACTION
            coinTransaction();
          } else if (contracts.indexOf(txn.to) >= 0) {
            //TOKEN TRANSACTIONS

            console.log(":: TOKEN TRANSACTION ::");

            pendingTokenTransactions.push(txn);

            // checkTokenTransaction(); // TODO
          }

          console.log("to",txn.from ,txn.to)
          if (wallets.indexOf(txn.from >= 0)) {
            // TRANSACTION FROM WALLET GOT CONFIRMED
            console.log(":: TRANSACTION FROM WALLET ::");

            let txFromDb = await transactionsModel
              .findOne({ hash: txn.hash })
              .lean()
              .exec();

            let status = constants.TXNS.SUCCESS;

            let balance = await provider.getBalance(txn.from);

            let user = await walletsModel
              .findOne({ "eth.address": txn.from })
              .lean()
              .exec();

            if (user != null) {
              // UPDATE THE TRANSACTION STATUS [SUCCESS]
              await transactionsModel.updateOne(
                {
                  $and: [
                    {
                      hash: txn.hash,
                    },
                    {
                      email: user.email,
                    },
                  ],
                },
                {
                  $set: {
                    status: status,
                  },
                }
              );

              // UPDATE THE WALLET BALANCE OF CORRESPONDING USER
              await walletsModel.updateOne(
                {
                  email: user.email,
                },
                {
                  $set: {
                    "eth.balance": String(balance),
                  },
                }
              );

              if (contracts.indexOf(tx.to) == -1) {
                let receiverWallet = await walletsModel
                  .findOne({ "eth.address": txn.to })
                  .lean()
                  .exec();

                //hotfix  - But it'll work
                if (receiverWallet != null) {
                  receiver = receiverWallet.email;
                } else {
                  receiver = txn.to;
                }
              }
            }
          }
        });
      }
    }

    isRunning = false;
  } catch (error) {
    console.log(":: CHECK_BLOCKS ::", error);
    return;
  }
};

const getWalletAddress = async () => {
  let address = [];

  try {
    let wallets = await walletsModel.find({}).lean().exec();

    wallets.forEach((users) => {
      address.push(users.eth.address);
    });

    console.log(":: WALLET ADDRESS ::", address);

    return address;
  } catch (error) {
    console.log("GETWALLETADDRESS::", error);

    return address;
  }
};

const coinTransaction = async () => {
  try {
    while (transactionsToAdd.length > 0) {
      let txn = transactionsToAdd[0];

      let user = await walletsModel
        .findOne({ "eth.address": txn.to })
        .lean()
        .exec();

      let txFromDb = await transactionsModel
        .findOne({ hash: txn.hash })
        .lean()
        .exec();

      if (user != null) {
        if (await isTransactionMine(txn.hash, user.email)) {
          // TRANSACTION NOT INTIATED FROM 'TO' ADDRESS

          let balance = await ethers.utils.formatEther(
            await provider.getBalance(txn.to)
          );

          console.log(":: IS_TRANSACTION_MINE_BALANCE ::", balance);

          await walletsModel.updateOne(
            {
              email: user.email,
            },
            {
              $set: {
                "eth.balance": String(balance),
              },
            },
            {
              upsert: true,
            }
          );

          await transactionsModel.updateOne(
            {
              hash: txn.hash,
            },
            {
              $set: {
                status: constants.TXNS.SUCCESS,
              },
            },
            {
              upsert: true,
            }
          );
        } else {
          // EXTERNAL TRANSACTION

          console.log(":: EXTERNAL TRANSACTION ::")

          // await transactionsModel.updateOne(
          //   {
          //     $and:[{
          //       hash: txn.hash
          //     },{
          //       status: constants.TXNS.PENDING
          //     }]
          //   },
          //   {
          //     $set: {
          //       status: constants.TXNS.SUCCESS,
          //     },
          //   },
          //   {
          //     upsert: true,
          //   }
          // );

          console.log("1",txn.gasLimit, (txn.gasLimit).toNumber() ,await ethers.utils.formatEther(txn.gasLimit)*(10**18))
          console.log("2",txn.gasPrice, (txn.gasPrice).toNumber(), await ethers.utils.formatEther(txn.gasPrice))
          console.log("3",await ethers.utils.parseEther(await ethers.utils.formatEther(txn.gasPrice)))
          await transactionsModel.create({
            email: user.email,
            ref: "",
            from: txn.from,
            to: txn.to,
            source: "eth",
            target: "eth",
            sourceAmount: await ethers.utils.formatEther(txn.value),
            targetAmount: await ethers.utils.formatEther(txn.value),
            value: await ethers.utils.formatEther(txn.value),
            type: "received",
            currency: "eth",
            error: "nil",
            hash: txn.hash,
            status: constants.TXNS.SUCCESS,
            error: "nil",
            reason: "",
            gasLimit: txn.gasLimit,
            gasPrice: txn.gasPrice,
            timestamp: String(new Date().getTime()),
          });

          let balance = await ethers.utils.formatEther(
            await provider.getBalance(txn.to)
          );

          await walletsModel.updateOne(
            {
              email: user.email,
            },
            {
              $set: {
                "eth.balance": String(balance),
              },
            },
            {
              upsert: true,
            }
          );
        }
      }

      transactionsToAdd.shift();
    }
  } catch (error) {
    console.log(":: COIN TRANSACTION ERROR ::", error);
    return;
  }
};

const isTransactionMine = async (hash, email) => {
  try {
    let transaction = await transactionsModel
      .findOne({
        $and: [
          {
            hash: hash,
          },
          {
            email: email,
          },
        ],
      })
      .lean()
      .exec();

    if (transaction == null || undefined || "") {
      return false;
    }

    return true;
  } catch (error) {
    console.log(":: IS_TRANSACTION_MINE ::", error);
    return;
  }
};

// init();
