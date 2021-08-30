var ethers = require("ethers");
var config = require("../config/config");
const mongoose = require("mongoose");
const constants = require("../constants/constants");
var contract_abi = require("../contract/abi").abi;
let abiDecoder = require("abi-decoder");
abiDecoder.addABI(contract_abi);
const walletsModel = require("../models/wallets");
const transactionsModel = require("../models/transactions");
const tokensModel = require("../models/tokens");

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
    // init();
    startConnection();
  });

// WEBSOCKET URL
var url = config.wallet.websocket; 

// PROVIDER
var provider = new ethers.providers.WebSocketProvider(url);

let transactionsToAdd = [];
let pendingTokenTransactions = [];
let blocksToCheck = [];
let latestBlock;
let lastCheckedBlock;
let initialBlock =
  config.wallet.initialBlock == '0'
    ? "latest"
    : config.wallet.initialBlock;
let isRunning = false;
let contracts = [];
var isTokenrunning = false;

const EXPECTED_PONG_BACK = 15000
const KEEP_ALIVE_CHECK_INTERVAL = 6000 //7500

const startConnection = async() => {
  provider = new ethers.providers.WebSocketProvider(url)

  let pingTimeout = null
  let keepAliveInterval = null

  provider._websocket.on('open', async() => {

    keepAliveInterval = setInterval(() => {
      console.log(':: CHECKING IF CONNECTION IS ALIVE, SENDING A PING');

      provider._websocket.ping();

      // Use `WebSocket#terminate()`, which immediately destroys the connection,
      // instead of `WebSocket#close()`, which waits for the close timer.
      // Delay should be equal to the interval at which your server
      // sends out pings plus a conservative assumption of the latency.
      pingTimeout = setTimeout(() => {
        provider._websocket.terminate()
      }, EXPECTED_PONG_BACK)
    }, KEEP_ALIVE_CHECK_INTERVAL)

    // TODO: handle contract listeners setup + indexing
    let contractData = await tokensModel.find({}).lean().exec();

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
        checkBlocks();
      }
      // provider.getTransaction(tx).then(function (transaction) {
      //   console.log(transaction);
      // });
    });
    // TODO
  })

  provider._websocket.on('close', () => {
    console.log(':: WEBSOCKET CONNECTION LOST :: RECONNECTING ::');
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startConnection();
  })

  provider._websocket.on('pong', () => {
    console.log(':: RECEIVED PONG, SO CONNECTION IS ALIVE, CLEARING TIMEOUT ::');
    clearInterval(pingTimeout);
  })
}

const checkBlocks = async () => {
  try {
    while (blocksToCheck.length > 0) {
      isRunning = true;

      let block = blocksToCheck[0];

      if (Number(block.number) <= Number(lastCheckedBlock)) {
        // console.log(":: CURRENT BLOCK :: ", block.number);

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
          // txn.to = await ethers.utils.getAddress(txn.to);
          // txn.from = await ethers.utils.getAddress(txn.from);

          let wallets = await getWalletAddress();

          let txFromDb = await transactionsModel
            .findOne({ hash: hash })
            .lean()
            .exec();

          if (txFromDb != null) {
            console.log(":: TRANSACTION FROM DB FOUND ::", txFromDb.hash, "\n");
          }

          if (
            txn.to ==
            (await ethers.utils.getAddress(
              "0x5f5f52dfdb123af72abc43ab36c191e05c9e5904"
            ))
          ) {
            console.log("::TXN::", txn);
          }

          if (wallets.indexOf(txn.to) >= 0) {
            // COIN TRANSACTIONS
            console.log(":: COIN TRANSACTION :: ");

            transactionsToAdd.push(txn);

            // ADD COIN TRANSACTION
            coinTransaction();
          } else if (contracts.indexOf(txn.to) >= 0) {
            //TOKEN TRANSACTIONS
            console.log("TASSA", txn);
            pendingTokenTransactions.push(txn);

            // ADD TOKEN TRANSACTION
            tokenTransaction();
          }

          if (wallets.indexOf(txn.from) >= 0) {
            // INTERNAL TRANSACTION - UPDATE THE STATUS OF TYPE : "SEND" UPON SUCCESSFULL TRANSACTION
            console.log(":: TRANSACTION FROM OUR WALLET :: \n");

            let txFromDb = await transactionsModel
              .findOne({ hash: txn.hash })
              .lean()
              .exec();

            let status = constants.TXNS.SUCCESS;

            let user = await walletsModel
              .findOne({ "bnb.address": txn.from })
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
                    gasPrice:txn.gasPrice,
                    gasLimit:txn.gasLimit,
                    fee: Number((txn.gasLimit)*(await ethers.utils.formatEther(txn.gasPrice))),
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
                    "bnb.balance": String(balance),
                  },
                }
              );
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
      address.push(users.bnb.address);
    });

    return address;
  } catch (error) {
    console.log(":: GETWALLETADDRESS :: ", error);

    return address;
  }
};

const coinTransaction = async () => {
  try {
    while (transactionsToAdd.length > 0) {
      let txn = transactionsToAdd[0];

      let user = await walletsModel
        .findOne({ "bnb.address": txn.to })
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
                "bnb.balance": String(balance),
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
            source: "bnb",
            target: "bnb",
            sourceAmount: await ethers.utils.formatEther(txn.value),
            targetAmount: await ethers.utils.formatEther(txn.value),
            value: await ethers.utils.formatEther(txn.value),
            type: "received",
            currency: "bnb",
            error: "nil",
            hash: txn.hash,
            status: constants.TXNS.SUCCESS,
            error: "nil",
            reason: "",
            gasLimit: txn.gasLimit,
            gasPrice: txn.gasPrice,
            fee: Number((txn.gasLimit)*(await ethers.utils.formatEther(txn.gasPrice))),
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
                "bnb.balance": String(balance),
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

  console.log(":: TOKEN TRANSACTION ::\n");

  try {
    while (pendingTokenTransactions.length > 0) {
      let txn = await provider.getTransactionReceipt(
        pendingTokenTransactions[0].hash
      );

      let transaction = pendingTokenTransactions[0];

      // console.log("CURRENT TRANSACTION::", txn);

      if (txn.status == true) {
        txn.from = await ethers.utils.getAddress(txn.from);
        txn.to = await ethers.utils.getAddress(txn.to);
        txn.hash = txn.transactionHash;

        console.log(":: TRANSACTION HASH :: ", txn.hash, "\n");

        let events = abiDecoder.decodeLogs(txn.logs);

        let user;
        let extractedEvent = {};

        let token = new ethers.Contract(
          txn.to, // CONTRACT ADDRESS
          contract_abi,
          provider
        );

        let token_decimal = await token.decimals();
        let token_symbol = await token.symbol();

        let senderBalance, receiverBalance;

        let txFromDb = await transactionsModel
          .findOne({
            hash: txn.hash,
          })
          .lean()
          .exec();

        await events.forEach(async (_event) => {
          if (_event["name"] == "Transfer") {
            await _event.events.forEach(async (param) => {
              extractedEvent[param.name] = param.value;
            });

            console.log("Extracted Event", extractedEvent);

            extractedEvent.to = await ethers.utils.getAddress(
              extractedEvent.to
            );

            extractedEvent.from = await ethers.utils.getAddress(
              extractedEvent.from
            );

            user = await walletsModel
              .findOne({ "bnb.address": extractedEvent.to })
              .lean()
              .exec();

            console.log("USER", txFromDb == null, user != null);

            if (txFromDb == null) {
              // EXTERNAL TOKEN TRANSACTIONS
              if (user != null) {
                await transactionsModel.create({
                  email: user.email,
                  ref: "",
                  from: extractedEvent.from,
                  to: extractedEvent.to,
                  source: token_symbol.toLowerCase(),
                  target: token_symbol.toLowerCase(),
                  sourceAmount: await ethers.utils.formatUnits(
                    extractedEvent.value,
                    token_decimal
                  ),
                  targetAmount: await ethers.utils.formatUnits(
                    extractedEvent.value,
                    token_decimal
                  ),
                  value: await ethers.utils.formatUnits(
                    extractedEvent.value,
                    token_decimal
                  ),
                  type: "received",
                  currency: token_symbol.toLowerCase(),
                  error: "nil",
                  hash: txn.hash,
                  status: constants.TXNS.SUCCESS,
                  error: "nil",
                  reason: "",
                  gasLimit: transaction.gasLimit,
                  gasPrice: transaction.gasPrice,
                  fee: Number((transaction.gasLimit)*(await ethers.utils.formatEther(transaction.gasPrice))),
                  timestamp: String(new Date().getTime()),
                });
              }
            } else if (txFromDb != null) {
              // INTERNAL TOKEN TRANSACTION [USER->USER]
              if (user != null) {
                await transactionsModel.create({
                  email: user.email,
                  ref: "",
                  from: extractedEvent.from,
                  to: extractedEvent.to,
                  source: token_symbol.toLowerCase(),
                  target: token_symbol.toLowerCase(),
                  sourceAmount: await ethers.utils.formatUnits(
                    extractedEvent.value,
                    token_decimal
                  ),
                  targetAmount: await ethers.utils.formatUnits(
                    extractedEvent.value,
                    token_decimal
                  ),
                  value: await ethers.utils.formatUnits(
                    extractedEvent.value,
                    token_decimal
                  ),
                  type: "received",
                  currency: token_symbol.toLowerCase(),
                  error: "nil",
                  hash: txn.hash,
                  status: constants.TXNS.SUCCESS,
                  error: "nil",
                  reason: "",
                  gasLimit: transaction.gasLimit,
                  gasPrice: transaction.gasPrice,
                  fee: Number((transaction.gasLimit)*(await ethers.utils.formatEther(transaction.gasPrice))),
                  timestamp: String(new Date().getTime()),
                });
              }
            }
          }
        });

        let receiverTxnCheck = null;
        let receiver = await walletsModel
          .findOne({
            "bnb.address": extractedEvent.to,
          })
          .lean()
          .exec();

        console.log("RECEIVER", receiver);

        if (receiver != null) {
          // INTERNAL WALLET TRANSACTIONS [NEW]
          receiverTxnCheck = await transactionsModel
            .findOne({
              $and: [
                {
                  hash: txn.hash,
                },
                {
                  type: "send",
                },
                {
                  to: extractedEvent.to,
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
        senderBalance = await ethers.utils.formatUnits(
          await token.balanceOf(txn.from),
          token_decimal
        );
        receiverBalance = await ethers.utils.formatUnits(
          await token.balanceOf(extractedEvent.to),
          token_decimal
        );

        let sender = await walletsModel
          .findOne({ "bnb.address": txn.from })
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
              .findOne({ "bnb.address": extractedEvent.to })
              .lean()
              .exec();

            if (receiver != null) {
              receiver = receiver.email;
            } else {
              receiver = extractedEvent.to;
            }
          }
        }

        // if (txFromDb != null) {
        // }

        // if (user != null) {
        //   let balance = await ethers.utils.formatUnits(
        //     await token.balanceOf(extractedEvent.to),
        //     token_decimal
        //   );

        //   await walletsModel.updateOne(
        //     { email: user.email },
        //     {
        //       $set: {
        //         [`${token_symbol.toLowerCase()}.balance`]: balance,
        //       },
        //     }
        //   );
        // }

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


var init = async () => {
  let contractData = await tokensModel.find({}).lean().exec();

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
      checkBlocks();
    }
    // provider.getTransaction(tx).then(function (transaction) {
    //   console.log(transaction);
    // });
  });

  // setInterval(() => {
  //   if (isRunning == false) {
  //     checkBlocks();
  //   }
  // }, 15000);

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