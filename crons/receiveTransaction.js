var ethers = require("ethers");
var config = require("../config/config");
const mongoose = require("mongoose");
const constants = require("../constants/constants");
var contract_abi = require("../contract/abi").abi;
let abiDecoder = require("abi-decoder");
abiDecoder.addABI(contract_abi);
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
  .then(async () => {
    // var provider = new ethers.providers.WebSocketProvider(url);
    // getWalletAddress();
    // init();
  });

// WEBSOCKET URL
var url = "wss://ropsten.infura.io/ws/v3/a478bf40f7b24494b30b082c0d225104";
// var url = "wss://bsc.getblock.io/testnet/?api_key=c3c3dca1-f735-4463-9b14-f108b37f942a";

// PROVIDER
var provider = new ethers.providers.WebSocketProvider(url);

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
let contracts = [];
var isTokenrunning = false;

var init = async () => {
  let contractData = config.wallet.contracts;
  contractData.forEach((_contractData) => {
    contracts.push(_contractData.address);
  });

  // EVENT LISTENING WHEN NEW BLOCKS MINED
  provider.on("block", async (tx) => {
    if (latestBlock == undefined) {
      latestBlock = await provider.getBlock(initialBlock);
      console.log(":: LATEST BLOCK :: ", latestBlock.number);
      blocksToCheck.push(latestBlock);
      lastCheckedBlock = latestBlock.number - 1;
    }

    latestBlock = await provider.getBlock(Number(latestBlock.number) + 1);

    if (latestBlock == null) {
      latestBlock = await provider.getBlock(lastCheckedBlock);
      console.log(":: PREVIOUS BLOCK :: ", latestBlock.number);
    } else {
      console.log(":: LATEST PENDING BLOCK :: ", latestBlock.number);
      blocksToCheck.push(latestBlock);
      // checkBlocks();
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

      if (Number(block.number) <= Number(lastCheckedBlock)) {
        console.log(":: CURRENT BLOCK :: ", block.number);

        blocksToCheck.shift();

        break;
      } else if (Number(block.number) > Number(lastCheckedBlock)) {
        blocksToCheck.shift();

        console.log(":: CHECKING BLOCK ::", block.number);

        lastCheckedBlock = block.number;

        console.log(
          ":: BLOCK TRANSACTIONS :: ",
          block.transactions.length,
          "\n"
        );

        await block.transactions.forEach(async (hash) => {
          let txn = await provider.getTransaction(hash);

          let wallets = await getWalletAddress();

          let txFromDb = await transactionsModel
            .findOne({ hash: hash })
            .lean()
            .exec();

          if (txFromDb != null) {
            console.log(":: TRANSACTION FROM DB FOUND ::", txFromDb.hash, "\n");
          }

          if (wallets.indexOf(txn.to) >= 0) {
            // COIN TRANSACTIONS

            // console.log(":: BNB TRANSACTION :: ",txn.hash);

            transactionsToAdd.push(txn);

            // ADD COIN TRANSACTION
            coinTransaction();
          } else if (contracts.indexOf(txn.to) >= 0) {
            //TOKEN TRANSACTIONS

            console.log(":: TOKEN TRANSACTION ::");

            pendingTokenTransactions.push(txn);

            // checkTokenTransaction(); // TODO
          }

          if (wallets.indexOf(txn.from) >= 0) {
            // INTERNAL TRANSACTION - UPDATE THE STATUS OF TYPE : "SEND" UPON SUCCESSFULL TRANSACTION
            console.log(":: TRANSACTION FROM WALLET :: \n");

            let txFromDb = await transactionsModel
              .findOne({ hash: txn.hash })
              .lean()
              .exec();

            let status = constants.TXNS.SUCCESS;

            let user = await walletsModel
              .findOne({ "eth.address": txn.from })
              .lean()
              .exec();

            if (user != null) {
              // UPDATE THE TRANSACTION STATUS [SUCCESS]

              let balance = await ethers.utils.formatEther(
                await provider.getBalance(txn.from)
              );

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
                    from: txn.from,
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

              // if (contracts.indexOf(txn.to) == -1) {
              //   let receiverWallet = await walletsModel
              //     .findOne({ "eth.address": txn.to })
              //     .lean()
              //     .exec();

              //   //hotfix  - But it'll work
              //   if (receiverWallet != null) {
              //     receiver = receiverWallet.email;
              //   } else {
              //     receiver = txn.to;
              //   }
              // }
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

    // console.log(":: WALLET ADDRESS ::", address);

    return address;
  } catch (error) {
    console.log("GETWALLETADDRESS::", error);

    return address;
  }
};

const coinTransaction = async () => {
  try {
    console.log(":: COIN TRANSACTION :: ");

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
          // EXTERNAL TRANSACTION [RECEIVE]

          console.log(":: EXTERNAL TRANSACTION FOUND :: ", txn.hash, "\n");

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

const tokenTransaction = async () => {
  isTokenrunning = true;

  try {
    while (pendingTokenTransactions > 0) {
      let txn = await provider.getTransactionReceipt(
        pendingTokenTransactions[0].push
      );

      if (txn.status == true) {
        txn.from = await ethers.utils.getAddress(txn.from);
        txn.to = await ethers.utils.getAddress(txn.to);
        txn.hash = txn.transactionHash;

        console.log(":: TRANSACTION HASH :: ", txn.hash);

        let events = abiDecoder.decodeLogs(txn.logs);

        let user;
        let extractedEvent = {};

        const token = new ethers.Contract(
          txn.contractAddress,
          contract_abi,
          provider
        );

        let token_decimal = await token.decimal();
        let token_symbol = await token.symbol();

        let senderBalance, receiverBalance;

        let txFromDb = await transactionsModel
          .findOne({
            hash: txn.hash,
          })
          .lean()
          .exec();

        await events.forEachAsync(async (_event) => {
          if (_event["name"] == "Transfer") {
            await _event.events.forEachAsync(async (param) => {
              extractedEvent[param.name] = param.value;
            });

            extractedEvent.to = await ethers.utils.getAddress(
              extractedEvent.to
            );

            user = await walletsModel
              .findOne({ "eth.address": extractedEvent.to })
              .lean()
              .exec();

            if (txFromDb == null) {
              if (user != null) {
                await transactionsModel.create({
                  email: user.email,
                  ref: "",
                  from: extractedEvent.from,
                  to: extractedEvent.to,
                  source: token_symbol,
                  target: token_symbol,
                  sourceAmount: await ethers.utils.formatEther(
                    extractedEvent.value
                  ),
                  targetAmount: await ethers.utils.formatEther(
                    extractedEvent.value
                  ),
                  value: await ethers.utils.formatEther(extractedEvent.value),
                  type: "received",
                  currency: token_symbol,
                  error: "nil",
                  hash: txn.hash,
                  status: constants.TXNS.SUCCESS,
                  error: "nil",
                  reason: "",
                  gasLimit: txn.gasLimit,
                  gasPrice: txn.gasPrice,
                  timestamp: String(new Date().getTime()),
                });
              }
            }
          }
        });

        let receiverTxnCheck = null;
        let receiver = await walletsModel
          .findOne({
            "eth.address": extractedEvent.to,
          })
          .lean()
          .exec();

        if (receiver != null) {
          receiverTxnCheck = await transactionsModel
            .findOne({
              $and: [
                {
                  hash: txn.hash,
                },
                {
                  to: extractedEvent.to,
                },
                {
                  email: receiver.email,
                },
              ],
            })
            .lean()
            .exec();
        }

        if (await isInternalTransaction(txn.hash)) {
          await transactionsModel.updateOne(
            {
              $and: [
                {
                  hash: txn.hash,
                },
                {
                  status: {
                    $ne: constants.TXNS.SUCCESS,
                  },
                },
              ],
            },
            {
              $set: {
                status: constants.TXNS.SUCCESS,
              },
            }
          );
        }

        // UPDATE SENDER / RECEIVERS TOKEN BALANCE
        senderBalance = await token.balanceOf(txn.from).call();
        receiverBalance = await token.balanceOf(extractedEvent.to).call();

        let sender = await walletsModel
          .findOne({ "eth.address": txn.from })
          .lean()
          .exec();

        if (user != null) {
          await walletsModel.updateOne(
            { email: user.email },
            {
              $set: {
                [`${token_symbol.toLowerCase()}.balance`]: receiverBalance,
              },
            }
          );
        }

        if (sender != null) {
          console.log(":: SENDER ACCOUNT :: ", sender);

          await walletsModel.updateOne(
            { email: sender.email },
            {
              $set: {
                [`${token_symbol.toLowerCase()}.balance`]: senderBalance,
              },
            }
          );

          if (txFromDb != null) {
            let receiver = await walletsModel
              .findOne({ "eth.address": extractedEvent.to })
              .lean()
              .exec();

            if (receiver != null) {
              receiver = receiver.email;
            } else {
              receiver = extractedEvent.to;
            }
          }
        }

        if (txFromDb != null) {
        }

        if (user != null) {
          let balance = await token.balanceOf(extractedEvent.to).call();

          await walletsModel.updateOne(
            { email: user.email },
            {
              $set: {
                [`${token_symbol.toLowerCase()}.balance`]: balance,
              },
            }
          );
        }

        pendingTokenTransactions.shift();
      } else {
        pendingTokenTransactions.shift();
      }
    }
    isTokenrunning = false;
  } catch (error) {
    isTokenrunning = false;
    console.log(":: TOKEN TRANSACTION ERROR :: ", error);
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

const isInternalTransaction = async (hash) => {
  try {
    let transaction = await transactionsModel
      .findOne({ hash: hash })
      .lean()
      .exec();

    if (transaction == null || undefined || "") {
      return false;
    }

    return true;
  } catch (error) {
    console.log(":: IS INTERNAL TRANSACTION ERROR :: ", error);
    return;
  }
};

// init();
