const ethers = require("ethers");
const axios = require("axios");
const { create } = require("ipfs-http-client");
const tokenABI = require("../artifacts/contracts/NFT.sol/NFT.json").abi;
const marketABI =
  require("../artifacts/contracts/NFTMarket.sol/NFTMarket.json").abi;
const config = require('../config/config');
const accountsModel = require("../models/accounts");
const transactionsModel = require("../models/transactions");
const walletsModel = require("../models/wallets");
const ethereum_lib = require("../lib/crypto/ethereum");
const wallet_library = require('../lib/blockchain/wallet');
const constants = require("../constants/constants");

var client, provider, tokenContract, marketContract, signerAddress;

// MARKETPLACE CONTRACT ADDRESS
const marketContractAddress = config.wallet.marketplace_address;

// NFT CONTRACT ADDRESS
const tokenContractAddress = config.wallet.nft_address;

// INITIALIZE IPFS
const initializeIPFS = async () => {
  try {
    const projectId = "1yAQKsMawsft8Fw9FtNX1ZOgPz8";
    const projectSecret = "5e1658b5a43a08c7257712e407b99e4d";
    const auth =
      "Basic " +
      Buffer.from(projectId + ":" + projectSecret).toString("base64");
    client = create({
      host: "ipfs.infura.io",
      port: 5001,
      protocol: "https",
      headers: {
        authorization: auth,
      },
    });
  } catch (error) {
    console.log(":: INITIALIZE_IPFS :: ERROR :: \n", error);
    return;
  }
};

// UPLOAD FILE TO IPFS
const uploadFileToIPFS = async (file, name, description) => {
  try {
    await initializeIPFS();

    //1 ADD File to IPFS
    const url = await client.add(file, {
      cidVersion: 1,
      hashAlg: "sha2-256",
    });

    console.log("URL::", url);

    // URL (1) https://gateway.ipfs.io/ipfs/ OR (2) https://ipfs.infura.io/ipfs/
    const uploadedImageUrl = `https://gateway.ipfs.io/ipfs/${url?.path}`;

    //2 ADD Metadata to IPFS
    const metadata = {
      name: name,
      description: description,
      image: uploadedImageUrl,
    };

    const metadataRes = await client.add(JSON.stringify(metadata), {
      cidVersion: 1,
      hashAlg: "sha2-256",
    });

    const metaDataUrl = `https://gateway.ipfs.io/ipfs/${metadataRes?.path}`;

    //3 return image & metadata URLs and also the CID for each
    return {
      uploadedImageUrl,
      metaDataUrl,
      metaDataHashCID: metadataRes?.path,
      imageHashCID: url?.path,
    };
  } catch (e) {
    console.log(":: ERROR UPLOADING TO IPFS ::", e);
    return;
  }
};

// INTITIALIZE WEB3
const initializeWeb3 = async () => {
  try {
    var url = config.wallet.provider; //""
    provider = new ethers.providers.JsonRpcProvider(url);
  } catch (error) {
    console.log(":: INITIALIZE_WEB3 :: ERROR :: \n", error);
    return;
  }
};

// INITIALIZE TOKEN CONTRACT
const initializeTokenContract = async (signer) => {
  try {
    tokenContract = new ethers.Contract(tokenContractAddress, tokenABI, signer);
    signerAddress = signer.address;
  } catch (error) {
    console.log(":: INITIALIZE_TOKEN_CONTRACT :: ERROR :: \n", error);
    return;
  }
};

// INITIALIZE MARKET CONTRACT
const initializeMarketContract = async (signer) => {
  try {
    marketContract = new ethers.Contract(
      marketContractAddress,
      marketABI,
      signer
    );
    signerAddress = signer.address;
  } catch (error) {
    console.log(":: INITIALIZE_MARKET_CONTRACT :: ERROR :: \n", error);
    return;
  }
};

// INITIALIZE SIGNER
const initializeSigner = async (email) => {
  try {

    console.log("EMAIL", email);

    let account = await accountsModel.findOne({ email: email }).lean().exec();

    console.log("account", account.ref);

    let privateKey = await (await wallet_library.generateAddress(account.ref, true)).privateKey;

    let wallet = new ethers.Wallet(
      privateKey,//"0b2df94bc3c969ea06d2e014053c940fdad8b4e63da05b169b4912db0e2ca25e",//"0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", //"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      provider
    );
    console.log("WALLET ::", privateKey);

    let walletSigner = wallet.connect(provider);
    // console.log("SIGNER ::", walletSigner);

    return walletSigner;
  } catch (error) {
    console.log(":: INITIALIZE_SIGNER :: ERROR :: \n", error);
    return;
  }
};

// CREATE NFT
const createNFT = async (email, URI) => {
  try {
    let promises = await Promise.all([
      initializeWeb3(),
      initializeTokenContract(await initializeSigner(email)),
      accountsModel.findOne({ email: email }).lean().exec()
    ]);

    const data = await tokenContract.createToken(URI, { gasLimit: Number(config.wallet.gasLimit) * 8 });

    let tx = await data.wait();

    if (tx.status) {

      let transactionFee = Number(tx.gasUsed.toString()) * Number(data.gasPrice.toString());

      let method = await ethereum_lib.functionDataDecoding(tokenABI, data.data);

      await transactionsModel.create({
        email: email,
        ref: promises[2].ref,
        from: tx.from,
        to: tx.to,
        source: 'bnb',
        target: 'bnb',
        sourceAmount: ethers.utils.formatEther(data.value),
        targetAmount: ethers.utils.formatEther(data.value),
        type: "send",
        currency: 'bnb',
        method: method,
        hash: tx.transactionHash,
        status: constants.TXNS.SUCCESS,
        error: "nil",
        gasLimit: tx.gasUsed.toString(),
        gasPrice: data.gasPrice.toString(),
        fee: ethers.utils.formatUnits(String(transactionFee)),
        timestamp: String(new Date().getTime()),
      });

      let event = tx.events[2];

      let value = event.args[1].toString();

      return {
        status: true,
        value: value
      };

    } else {

      return {
        status: false,
        value: "Token Creation Failed"
      };

    }

  } catch (error) {

    if (error.code) {
      return {
        status: false,
        value: error.code
      };
    }

    console.log(":: CREATE_NFT :: ERROR :: ", error);

    return;
  }
};

// CREATE MARKET ITEM - CREATE NFT
const createMarketItem = async (email, URI, price) => {
  try {
    let promises = await Promise.all([
      initializeWeb3(),
      initializeTokenContract(await initializeSigner(email)),
      initializeMarketContract(await initializeSigner(email)),
      accountsModel.findOne({ email: email }).lean().exec()
    ]);

    // LISTING PRICE
    const listingPrice = await marketContract.getListingPrice();

    // AUCTION PRICE
    const auctionPrice = await ethers.utils.parseUnits(price, "ether");

    //CHECK WALLET BALANCE
    let balance = await checkBalance(email, "createMarketItem", ethers.utils.formatEther(listingPrice));
    console.log("BALANCE", balance);

    if (balance.status) {

      // RETRIEVE THE TOKEN ID OF NEW NFT
      let tokenId = await createNFT(email, URI);

      if (tokenId.status) {

        // LIST A NEW NFT
        let data = await marketContract.createMarketItem(
          tokenContractAddress,
          tokenId.value,
          auctionPrice,
          { value: listingPrice, gasLimit: Number(config.wallet.gasLimit) * 8 }
        );


        let tx = await data.wait();

        if (tx.status) {

          let transactionFee = Number(tx.gasUsed.toString()) * Number(data.gasPrice.toString());

          let method = await ethereum_lib.functionDataDecoding(marketABI, data.data);

          await transactionsModel.create({
            email: email,
            ref: promises[3].ref,
            from: tx.from,
            to: tx.to,
            source: 'bnb',
            target: 'bnb',
            sourceAmount: ethers.utils.formatEther(data.value),
            targetAmount: ethers.utils.formatEther(data.value),
            type: "send",
            currency: 'bnb',
            method: method,
            hash: tx.transactionHash,
            status: constants.TXNS.SUCCESS,
            error: "nil",
            gasLimit: tx.gasUsed.toString(),
            gasPrice: data.gasPrice.toString(),
            fee: ethers.utils.formatUnits(String(transactionFee)),
            timestamp: String(new Date().getTime())

          });

          let event = tx.events[2];
          let item = {
            itemId: event.args[0].toString(),
            tokenId: event.args[2].toString(),
            price: event.args[5].toString(),
          };

          return {
            status: true,
            statusCode: constants.STATUS.SUCCESS,
            data: item
          }

        } else {

          return {
            status: false,
            statusCode: constants.STATUS.UNPROCESSABLE_ENTITY,
            data: "Item Creation Failed"
          }

        }

      } else {

        return {
          status: tokenId.status,
          statusCode: constants.STATUS.UNPROCESSABLE_ENTITY,
          data: tokenId.value == "INSUFFICIENT_FUNDS" ? "Insufficient Balance" : tokenId.value
        }

      }

    } else {

      return {
        status: false,
        statusCode: constants.STATUS.UNPROCESSABLE_ENTITY,
        data: "Insufficient Balance"
      }

    }

  } catch (error) {
    console.log("ERRR", error)
    let errorCode = await reason(error.transactionHash);

    if (errorCode) {
      return {
        error: errorCode
      }
    } else {
      if (error.code) {
        return { error: error.reason };
      }
    }


    if (error.value.error) {
      return { error: error.value.error }; // Check the wallet balance instead

    } else if (error.code) {
      return { error: error.code };
    }

    let err = JSON.parse(error.error.body).error.message;
    err = err.substring(err.indexOf("'") + 1, err.lastIndexOf("'"));

    console.log(":: CREATE_MARKET_ITEM :: ERROR :: ", err);

    return { error: err };
  }
};

// C H E C K    A C C O U N T    B A L A N C E
const checkBalance = async (
  email,
  method,
  amount
) => {

  let transactionFee, gasLimit, gasPrice, actualBalance, balance;

  amount = Number(amount);

  gasLimit = Number(config.wallet.gasLimit) * 8;

  gasPrice = Number(config.wallet.gasPrice);

  actualBalance = await walletsModel.findOne({ email: email }).lean().exec();

  actualBalance = Number(actualBalance.bnb.balance);

  console.log(":: WALLET BALANCE :: ", actualBalance);

  console.log(":: GAS PRICE :: ", gasPrice);

  console.log(":: GAS LIMIT ::", gasLimit);

  if (method == "createMarketItem") {

    transactionFee = (2 * gasPrice * (gasLimit * 8)); // 2 -> Two transactions [createToken & createMarketItem]
    console.log(":: TXN FEE :: ", transactionFee);

    balance = Number(actualBalance) - Number(transactionFee);
    console.log(":: BALANCE :: ", balance);

  } else if (method == "createMarketSale") {

    transactionFee = (gasPrice * (gasLimit * 8));
    console.log(":: TXN FEE :: ", transactionFee);

    balance = Number(actualBalance) - Number(transactionFee);
    console.log(":: BALANCE :: ", balance);

  }

  if (amount < balance) {

    let resultantBalance = Number(balance) - Number(amount)

    await walletsModel.updateOne(
      {
        email: email,
      },
      {
        $set: {
          'bnb.balance': String(resultantBalance)
        },
      }
    );

    return {
      status: true,
      balance: actualBalance,
      total: transactionFee + amount,
    };

  } else {
    return {
      status: false,
      balance: actualBalance,
      total: transactionFee + amount
    };
  }
};

// CREATE MARKET SALE - BUY NFT
const createMarketSale = async (email, itemId, price) => {
  try {
    let promises = await Promise.all([
      initializeWeb3(),
      initializeMarketContract(await initializeSigner(email)),
      accountsModel.findOne({ email: email }).lean().exec()
    ]);

    // LISTING & AUCTION PRICE
    const auctionPrice = await ethers.utils.parseUnits(price, "ether");

    //CHECK WALLET BALANCE
    let balance = await checkBalance(email, "createMarketSale", Number(price));
    console.log("BALANCE", balance);

    if (balance.status) {

      // LIST A NEW NFT
      let data = await marketContract.createMarketSale(
        tokenContractAddress,
        itemId,
        { value: auctionPrice, gasLimit: Number(config.wallet.gasLimit) * 8 }
      );

      let tx = await data.wait();

      if (tx.status) {

        let transactionFee = Number(tx.gasUsed.toString()) * Number(data.gasPrice.toString());

        let method = await ethereum_lib.functionDataDecoding(marketABI, data.data);

        await transactionsModel.create({
          email: email,
          ref: promises[2].ref,
          from: tx.from,
          to: tx.to,
          source: 'bnb',
          target: 'bnb',
          sourceAmount: ethers.utils.formatEther(data.value),
          targetAmount: ethers.utils.formatEther(data.value),
          type: "send",
          currency: 'bnb',
          method: method,
          hash: tx.transactionHash,
          status: constants.TXNS.SUCCESS,
          error: "nil",
          gasLimit: tx.gasUsed.toString(),
          gasPrice: data.gasPrice.toString(),
          fee: ethers.utils.formatUnits(String(transactionFee)),
          timestamp: String(new Date().getTime())

        });

        let event = tx.events[2];
        console.log("EVENTS:",event);
        let item = {
          itemId: event.args[0].toString(),
          tokenId: event.args[2].toString(),
          price: event.args[5].toString(),
        };

        return {
          status: true,
          statusCode: constants.STATUS.SUCCESS,
          data: item
        }

      } else {

        return {
          status: false,
          statusCode: constants.STATUS.UNPROCESSABLE_ENTITY,
          data: "Item Sale Failed"
        }

      }

    } else {

      return {
        status: false,
        statusCode: constants.STATUS.UNPROCESSABLE_ENTITY,
        data: "Insufficient Balance"
      }

    }

  } catch (error) {

    console.log("ERROR::", error)

    let errorCode = await reason(error.transactionHash);

    if (errorCode) {
      console.log("errorCode::", errorCode);
      return {
        error: errorCode
      }
    } else {
      if (error.code) {
        console.log("errorCode::", error.reason);
        return { error: error.reason };
      }
    }

    if (error.code) {
      return { error: error.reason };
    }

    let err = JSON.parse(error.error.body).error.message;
    err = err.substring(err.indexOf("'") + 1, err.lastIndexOf("'"));

    console.log(":: CREATE_MARKET_SALE :: ERROR :: ", err);

    return { error: err };
  }
};

// RETRIEVE ALL MARKET ITEMS - EXCEPT OWN NFT ITEMS CREATED
const fetchMarketItems = async (email) => {
  try {
    await Promise.all([
      initializeWeb3(),
      initializeMarketContract(await initializeSigner(email)),
      initializeTokenContract(await initializeSigner(email)),
    ]);

    const data = await marketContract.fetchMarketItems();

    if (data == null) {
      return [];
    }

    const items = await Promise.all(
      data.map(async (i) => {
        if (i.seller != signerAddress) {
          const tokenURI = await tokenContract.tokenURI(i.tokenId);

          const meta = await axios.get(tokenURI);

          let price = ethers.utils.formatUnits(i.price.toString(), "ether");

          let item = {
            price,
            tokenId: i.tokenId.toNumber(),
            seller: i.seller,
            // owner: i.owner,
            image: meta.data.image,
            name: meta.data.name,
            description: meta.data.description,
          };
          console.log(":AFSasgf", item)
          return item;
        }
      })
    );

    if (items.includes(undefined)) {
      return []
    } else {
      return items;
    }

  } catch (error) {

    if (error.code) {
      return { error: error.code };
    }

    console.log(":: FETCH_MARKET_ITEMS :: ERROR :: \n", error);
    return;
  }
};

// RETRIEVE MY NFTs
const fetchMyNFTs = async (email) => {
  try {
    await Promise.all([
      initializeWeb3(),
      initializeMarketContract(await initializeSigner(email)),
      initializeTokenContract(await initializeSigner(email)),
    ]);

    const data = await marketContract.fetchMyNFTs();

    if (data == null) {
      return [];
    }

    const items = await Promise.all(
      data.map(async (i) => {
        const tokenURI = await tokenContract.tokenURI(i.tokenId);

        const meta = await axios.get(tokenURI);

        let price = ethers.utils.formatUnits(i.price.toString(), "ether");

        let item = {
          price,
          tokenId: i.tokenId.toNumber(),
          seller: i.seller,
          owner: i.owner,
          image: meta.data.image,
          name: meta.data.name,
          description: meta.data.description,
        };

        return item;
      })
    );

    return items;
  } catch (error) {

    if (error.code) {
      return { error: error.code };
    }

    console.log(":: FETCH_MY_NFTs :: ERROR :: \n", error);
    return;
  }
};

// RETRIEVE ITEMS CREATED BY THEMSELVES
const fetchItemsCreated = async (email) => {
  try {
    await Promise.all([
      initializeWeb3(),
      initializeMarketContract(await initializeSigner(email)),
      initializeTokenContract(await initializeSigner(email)),
    ]);

    const data = await marketContract.fetchItemsCreated();

    if (data == null) {
      return [];
    }

    const items = await Promise.all(
      data.map(async (i) => {
        const tokenURI = await tokenContract.tokenURI(i.tokenId);

        const meta = await axios.get(tokenURI);

        let price = ethers.utils.formatUnits(i.price.toString(), "ether");

        let item = {
          price,
          tokenId: i.tokenId.toNumber(),
          seller: i.seller,
          owner: i.owner,
          image: meta.data.image,
          name: meta.data.name,
          description: meta.data.description,
        };

        return item;
      })
    );

    return items;
  } catch (error) {

    if (error.code) {
      return { error: error.code };
    }

    console.log(":: FETCH_ITEMS_CREATED :: ERROR :: \n", error);
    return;
  }
};

// HEX TO ASCII
const hex_to_ascii = async (str1) => {
  var hex = str1.toString();
  var str = '';
  for (var n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return str;
}

// CONTRACT REVERT REASON
const reason = async (hash) => {
  let tx = await provider.getTransaction(hash)
  if (!tx) {
    console.log('tx not found')
  } else {
    let code = await provider.call(tx, tx.blockNumber)
    let reason = hex_to_ascii(code.substr(138))
    return reason;
  }
}

module.exports = {
  uploadFileToIPFS,
  createMarketItem,
  createMarketSale,
  fetchMarketItems,
  fetchMyNFTs,
  fetchItemsCreated
};
