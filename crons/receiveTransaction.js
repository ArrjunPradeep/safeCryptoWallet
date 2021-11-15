var ethers = require("ethers");
var config = require("../config/config");
const mongoose = require("mongoose");
const constants = require("../constants/constants");
var contract_abi = require("../contract/abi").abi;
var nft_token_contract_abi = require("../artifacts/contracts/NFT.sol/NFT.json").abi;
var nft_marketplace_contract_abi = require("../artifacts/contracts/NFTMarket.sol/NFTMarket.json").abi;
let abiDecoder = require("abi-decoder");
abiDecoder.addABI(contract_abi);
let ethereum_lib = require("../lib/crypto/ethereum");
const walletsModel = require("../models/wallets");
const transactionsModel = require("../models/transactions");
const nft = require("../nft/nft");
const tokensModel = require("../models/tokens");
const settingsModel = require("../models/settings");
const nftsModel = require("../models/nft");
const requestPromise = require("request-promise");

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
    config.db.dbName,
    {
      useNewUrlParser: true,
      useCreateIndex: true,
      useUnifiedTopology: true
    }
  )
  .then(async () => {

    console.log(":::::::  MONGODB CONNECTED :::::::");

    startConnection();

  }).catch((error) => {

    console.log("::::::: MONGODB NOT CONNECTED :::::::");

  })

// WEBSOCKET URL
var url = config.wallet.websocket;

// PROVIDER
var provider = new ethers.providers.WebSocketProvider(url);

let transactionsToAdd = [];
let pendingTokenTransactions = [];
let nftTransactionsToAdd = [];
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
const KEEP_ALIVE_CHECK_INTERVAL = 6000 //7500||6000

const startConnection = async () => {

  console.log(" ::::: START CONNECTION ::::: ");

  provider = new ethers.providers.WebSocketProvider(url);

  let pingTimeout = null
  let keepAliveInterval = null

  provider._websocket.on('open', async () => {

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
          block.transactions,
          "\n"
        );

        await block.transactions.forEach(async (hash) => {
          let txn = await provider.getTransaction(hash);
          // txn.to = await ethers.utils.getAddress(txn.to);
          // txn.from = await ethers.utils.getAddress(txn.from);

          let wallets = await getWalletAddress();

          let nfts = await getNftAddress();

          let txFromDb = await transactionsModel
            .findOne({ hash: hash })
            .lean()
            .exec();

          if (txFromDb != null) {
            console.log(":: TRANSACTION FROM DB FOUND ::", txFromDb, "/n", txn);
          }

          if (wallets.indexOf(txn.to) >= 0) {
            // COIN TRANSACTIONS
            transactionsToAdd.push(txn);

            coinTransaction();

          } else if (contracts.indexOf(txn.to) >= 0) {
            //TOKEN TRANSACTIONS
            pendingTokenTransactions.push(txn);

            tokenTransaction();

          } else if (nfts.indexOf(txn.to) >= 0 && txFromDb != null) {
            // NFT TRANSACTIONS
            nftTransactionsToAdd.push(txn);

            nftTransaction(txFromDb);
          }

          if (wallets.indexOf(txn.from) >= 0 && nfts.indexOf(txn.to) == -1) { // 2nd => TXN.TO != NFT_TOKEN_ADDRESS [CreateToken]
            // INTERNAL TRANSACTION - UPDATE THE STATUS OF TYPE : "SEND" UPON SUCCESSFULL TRANSACTION
            console.log(":: TRANSACTION FROM OUR WALLET :: \n", txn);

            let txFromDb = await transactionsModel
              .findOne({ hash: txn.hash })
              .lean()
              .exec();

            let status = constants.TXNS.SUCCESS;

            let user = await walletsModel
              .findOne({ "bnb.address": txn.from })
              .lean()
              .exec();

            if (user != null) {  // ADD txFromDb Condition !=null
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
                    gasPrice: txn.gasPrice,
                    gasLimit: txn.gasLimit,
                    fee: Number((txn.gasLimit) * (await ethers.utils.formatEther(txn.gasPrice))),
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

const getNftAddress = async () => {

  let nftContracts = [];

  try {
    let nftData = await settingsModel.findOne({}).lean().exec();

    nftContracts.push(nftData.marketplace_address, nftData.nft_address);

    return nftContracts;

  } catch (error) {
    console.log(":: GET_NFT_ADDRESSESS :: ", error);

    return address;
  }
};

const nftTransaction = async (txFromDb) => {
  try {

    console.log(":: NFT TRANSACTION ::");

    while (nftTransactionsToAdd.length > 0) {

      let txn = await provider.getTransactionReceipt(
        nftTransactionsToAdd[0].hash
      );

      console.log(":: NFT STATUS ::", txn.status);

      let account = await walletsModel.findOne({ email: txFromDb.email }).lean().exec();

      let nftInfo = await getNftAddress();

      let method, contract, filter, logs, event;

      if (nftInfo.indexOf(txn.to) == 1) {

        method = await ethereum_lib.functionDataDecoding(nft_token_contract_abi, nftTransactionsToAdd[0].data);
        contract = new ethers.Contract(txn.to, nft_token_contract_abi, provider);

      } else if (nftInfo.indexOf(txn.to) == 0) {

        method = await ethereum_lib.functionDataDecoding(nft_marketplace_contract_abi, nftTransactionsToAdd[0].data);
        contract = new ethers.Contract(txn.to, nft_marketplace_contract_abi, provider);

      }

      if (txn.status) {

        txn.from = await ethers.utils.getAddress(txn.from);
        txn.to = await ethers.utils.getAddress(txn.to);
        txn.hash = txn.transactionHash;
        txn.method = method;

        switch (txn.method) {

          case 'createToken':

            console.log(" :: CREATE TOKEN :: ");

            filter = await contract.filters.newToken(txn.from, null, null);
            logs = await contract.queryFilter(filter, txn.blockNumber, "latest");

            console.log("BLOCK NUMBER::", txn.blockNumber);

            event = {
              from: logs[0].args._from.toString(),
              tokenId: logs[0].args._tokenId.toString(),
              uri: logs[0].args._uri.toString()
            }

            console.log("EVENT INFO :: ", event);

            if (logs.length > 0) {

              await nftsModel.create({
                email: account.email,
                tokenId: event.tokenId,
                tokenURI: event.uri,
                metadata: {
                  name: txFromDb.metadata.name,
                  description: txFromDb.metadata.description,
                  image: txFromDb.metadata.image
                },
                timestamp: String(new Date().getTime())
              })

            }

            break;

          case 'createMarketItem':

            console.log(" :: CREATE MARKET ITEM :: ");

            filter = await contract.filters.MarketItemCreated(null, null, null, txn.from);
            logs = await contract.queryFilter(filter, txn.blockNumber, "latest");

            console.log("BLOCK NUMBER::", txn.blockNumber);

            event = {
              itemId: logs[0].args.itemId.toString(),
              nftContract: logs[0].args.nftContract.toString(),
              tokenId: logs[0].args.tokenId.toString(),
              seller: logs[0].args.seller.toString(),
              owner: logs[0].args.owner.toString(),
              price: logs[0].args.price.toString(),
              sold: logs[0].args.sold.toString()
            }

            console.log(":: EVENT_INFO :: ", event);

            if (logs.length > 0) {

              await nftsModel.updateOne({
                $and: [
                  {
                    email: txFromDb.email
                  },
                  {
                    tokenId: event.tokenId,
                  }
                ]
              },
                {
                  $set: {
                    itemId: event.itemId,
                    seller: event.seller,
                    owner: event.owner,
                    active: true,
                    price: ethers.utils.formatEther(event.price),
                    sold: event.sold
                  }
                },
                {
                  upsert: true
                }
              )

            }

            break;

          case 'createMarketSale':

            console.log(" :: CREATE MARKET SALE :: ");

            filter = await contract.filters.MarketItemSold(null, null, null, null, txn.from);
            logs = await contract.queryFilter(filter, txn.blockNumber, "latest");

            console.log("BLOCK NUMBER::", txn.blockNumber, logs[0]);

            event = {
              itemId: logs[0].args.itemId.toString(),
              nftContract: logs[0].args.nftContract.toString(),
              tokenId: logs[0].args.tokenId.toString(),
              seller: logs[0].args.seller.toString(),
              owner: logs[0].args.owner.toString(),
              price: logs[0].args.price.toString(),
              sold: logs[0].args.sold.toString()
            }

            console.log(":: EVENT_INFO :: ", event);

            if (logs.length > 0) {

              await nftsModel.updateOne(
                {
                  $and: [
                    {
                      tokenId: event.tokenId,
                    },
                    {
                      itemId: event.itemId
                    }
                  ]
                }
                ,
                {
                  $set: {
                    itemId: event.itemId,
                    seller: event.seller,
                    owner: event.owner,
                    active: true,
                    price: ethers.utils.formatEther(event.price),
                    sold: event.sold
                  }
                },
                {
                  upsert: true
                }
              )

              let sellerAccount = await walletsModel.findOne({ 'bnb.address': event.seller }).lean().exec();

              if (sellerAccount != null) {

                let sellerBalance = Number(sellerAccount.bnb.balance);
                let auctionPrice = Number(ethers.utils.formatEther(event.price));

                let newBalance = sellerBalance + auctionPrice;

                let gasLimit = txn.gasUsed.toString();
                let gasPrice = ethers.utils.formatEther(nftTransactionsToAdd[0].gasPrice.toString());
                let txnFee = Number(gasLimit)*Number(gasPrice);

                // TRACK THE TRANSFER OF AUCTION PRICE TO SELLER - TXN HASH is confusing
                await transactionsModel.create({
                  email: sellerAccount.email,
                  ref: "",
                  from: txn.from,
                  to: sellerAccount.bnb.address,
                  source: "bnb",
                  target: "bnb",
                  sourceAmount: await ethers.utils.formatEther(event.price),
                  targetAmount: await ethers.utils.formatEther(event.price),
                  value: await ethers.utils.formatEther(event.price),
                  type: "received",
                  method: "transfer",
                  currency: "bnb",
                  error: "nil",
                  hash: txn.hash,
                  status: constants.TXNS.SUCCESS,
                  error: "nil",
                  reason: "",
                  gasLimit: gasLimit,
                  gasPrice: gasPrice,
                  fee: String(txnFee),
                  timestamp: String(new Date().getTime()),
                });


                await walletsModel.updateOne({
                  'bnb.address': event.seller
                },
                  {
                    $set: {
                      'bnb.balance': newBalance
                    }
                  },
                  {
                    upsert: true
                  })

              }

            }

            break;

          default:

            console.log(" :: DEFAULT :: ");
            break;

        }

        console.log("LOGS", logs.length);

        if (logs.length > 0) {

          let currentBalance = account.bnb.balance;

          let gasLimit = txn.gasUsed.toString();
          let gasPrice = ethers.utils.formatEther(nftTransactionsToAdd[0].gasPrice.toString());
          let oldTxnFee = txFromDb.fee;

          let newBalance = Number(currentBalance) + Number(oldTxnFee) - (Number(gasLimit) * Number(gasPrice));

          console.log("NEW BALANCE::", newBalance);

          await transactionsModel.updateOne(
            {
              $and: [
                {
                  hash: txn.hash,
                },
                {
                  status: {
                    $eq: constants.TXNS.PENDING,
                  },
                },
              ],
            },
            {
              $set: {
                status: constants.TXNS.SUCCESS,
                gasLimit: txn.gasUsed.toString(),
                gasPrice: config.wallet.gasPrice,
                fee: String(Number(txn.gasUsed) * Number(config.wallet.gasPrice))
              },
            }
          );

          await walletsModel.updateOne({
            email: txFromDb.email
          },
            {
              $set: {
                'bnb.balance': String(newBalance)
              }
            }
          );

        }

      } else {

        console.log("TXN FAILED");

        let currentBalance = account.bnb.balance;

        let gasLimit = txn.gasUsed.toString();
        let gasPrice = ethers.utils.formatEther(nftTransactionsToAdd[0].gasPrice.toString());
        let oldTxnFee = txFromDb.fee;

        let newBalance = Number(currentBalance) + Number(txFromDb.sourceAmount) + Number(oldTxnFee) - (Number(gasLimit) * Number(gasPrice));

        console.log("NEW BALANCE::", newBalance);

        await transactionsModel.updateOne(
          {
            hash: txn.transactionHash
          },
          {
            $set: {
              status: constants.TXNS.FAILED,
              gasLimit: txn.gasUsed.toString(),
              gasPrice: config.wallet.gasPrice,
              fee: String(Number(txn.gasUsed) * Number(config.wallet.gasPrice))
            },
          },
          {
            upsert: true
          }
        );

        await walletsModel.updateOne({
          email: txFromDb.email
        },
          {
            $set: {
              'bnb.balance': String(newBalance)
            }
          }
        );
      }

      nftTransactionsToAdd.shift();

    }

  } catch (error) {

    console.log(":: NFT_TRANSACTION_ERROR ::", error);

    return;

  }
}

const coinTransaction = async () => {
  try {
    while (transactionsToAdd.length > 0) {
      let txn = transactionsToAdd[0];

      console.log(":: COIN TRANSACTION :: ");

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
            method: "transfer",
            currency: "bnb",
            error: "nil",
            hash: txn.hash,
            status: constants.TXNS.SUCCESS,
            error: "nil",
            reason: "",
            gasLimit: txn.gasLimit,
            gasPrice: txn.gasPrice,
            fee: Number((txn.gasLimit) * (await ethers.utils.formatEther(txn.gasPrice))),
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
                  method: "transfer",
                  currency: token_symbol.toLowerCase(),
                  error: "nil",
                  hash: txn.hash,
                  status: constants.TXNS.SUCCESS,
                  error: "nil",
                  reason: "",
                  gasLimit: transaction.gasLimit,
                  gasPrice: transaction.gasPrice,
                  fee: Number((transaction.gasLimit) * (await ethers.utils.formatEther(transaction.gasPrice))),
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
                  method: "transfer",
                  currency: token_symbol.toLowerCase(),
                  error: "nil",
                  hash: txn.hash,
                  status: constants.TXNS.SUCCESS,
                  error: "nil",
                  reason: "",
                  gasLimit: transaction.gasLimit,
                  gasPrice: transaction.gasPrice,
                  fee: Number((transaction.gasLimit) * (await ethers.utils.formatEther(transaction.gasPrice))),
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