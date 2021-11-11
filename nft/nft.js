const ethers = require("ethers");
const axios = require("axios");
const { create } = require("ipfs-http-client");
const tokenABI = require("../artifacts/contracts/NFT.sol/NFT.json").abi;
const marketABI =
  require("../artifacts/contracts/NFTMarket.sol/NFTMarket.json").abi;
const config = require('../config/config');
const accountsModel = require("../models/accounts");
const transactionsModel = require("../models/transactions");
const settingsModel = require("../models/settings");
const walletsModel = require("../models/wallets");
const nftsModel = require("../models/nft");
const ethereum_lib = require("../lib/crypto/ethereum");
const wallet_library = require('../lib/blockchain/wallet');
const constants = require("../constants/constants");

var client, provider, tokenContract, marketContract, signerAddress, marketContractAddress, tokenContractAddress;

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

    // NFT CONTRACT ADDRESS
    tokenContractAddress = (await settingsModel.findOne({}).lean().exec()).nft_address;

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

    // MARKETPLACE CONTRACT ADDRESS
    marketContractAddress = (await settingsModel.findOne({}).lean().exec()).marketplace_address;
    console.log("asfdfasfgvasf", marketContractAddress);

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
    console.log("SIGNER ::", walletSigner);

    return walletSigner;
  } catch (error) {
    console.log(":: INITIALIZE_SIGNER :: ERROR :: \n", error);
    return;
  }
};

// CREATE NFT
const createToken = async (email, URI, name, description, image) => {
  try {
    let promises = await Promise.all([
      initializeWeb3(),
      initializeTokenContract(await initializeSigner(email)),
      accountsModel.findOne({ email: email }).lean().exec(),
      walletsModel.findOne({ email: email }).lean().exec()
    ]);

    //CHECK WALLET BALANCE
    let balance = await checkBalance(email, '0');
    console.log("BALANCE", balance);

    if (balance.status) {

      let transactionFee, data;

      transactionFee = Number(balance.gasLimit) * Number(balance.gasPrice);

      await transactionsModel.create({
        email: email,
        ref: promises[2].ref,
        from: promises[3].bnb.address,
        to: tokenContractAddress,
        source: 'bnb',
        target: 'bnb',
        sourceAmount: ethers.utils.formatEther('0'),
        targetAmount: ethers.utils.formatEther('0'),
        type: "send",
        currency: 'bnb',
        method: "createToken",
        uri: URI,
        metadata: {
          name: name,
          description: description,
          image: image
        },
        hash: "",
        status: constants.TXNS.IN_QUEUE,
        error: "nil",
        gasLimit: balance.gasLimit,
        gasPrice: balance.gasPrice,
        fee: String(transactionFee),
        timestamp: String(new Date().getTime())
      });

      return {
        status: true,
        statusCode: constants.STATUS.SUCCESS,
        data: {
          data: "Transaction Processing"
        }
      }

    } else {
      return {
        status: false,
        statusCode: constants.STATUS.UNPROCESSABLE_ENTITY,
        data: {
          data: "Insufficient Balance",
          availableBalance: balance.balance,
          estimatedValue: balance.total
        }
      }
    }

  } catch (error) {

    console.log(":: CREATE_NFT :: ERROR :: ", error);

    return {
      status: false,
      statusCode: constants.STATUS.INTERNAL_SERVER_ERROR,
      data: {
        data: "Internal Server Error"
      }
    };

  }
};

// IPFS METADATA
const metadata = async (url) => {

  try {

    const config = {
      method: "GET",
      url: url
    };

    const response = await axios(config);

    console.log(":: METADATA :: ", response.data);

    return response.data;

  } catch (error) {

    console.log(":: METADATA_ERROR :: ", error);
    return;

  }

}

// CREATE MARKET ITEM - CREATE NFT
const createMarketItem = async (email, tokenId, price) => {
  try {
    let promises = await Promise.all([
      initializeWeb3(),
      initializeTokenContract(await initializeSigner(email)),
      accountsModel.findOne({ email: email }).lean().exec(),
      walletsModel.findOne({ email: email }).lean().exec(),
      initializeMarketContract(await initializeSigner(email))
    ]);

    // LISTING PRICE
    const listingPrice = await marketContract.getListingPrice();

    //CHECK WALLET BALANCE
    let balance = await checkBalance(email, ethers.utils.formatEther(listingPrice));
    console.log("BALANCE", balance);

    if (balance.status) {

      let transactionFee, data;

      transactionFee = Number(balance.gasLimit) * Number(balance.gasPrice);

      await transactionsModel.create({
        email: email,
        ref: promises[2].ref,
        from: promises[3].bnb.address,
        to: marketContractAddress,
        source: 'bnb',
        target: 'bnb',
        sourceAmount: ethers.utils.formatEther(listingPrice),
        targetAmount: ethers.utils.formatEther(listingPrice),
        type: "send",
        currency: 'bnb',
        method: "createMarketItem",
        auctionPrice: price,
        hash: "",
        status: constants.TXNS.IN_QUEUE,
        error: "nil",
        tokenId: tokenId,
        gasLimit: balance.gasLimit,
        gasPrice: balance.gasPrice,
        fee: String(transactionFee),
        timestamp: String(new Date().getTime())
      });

      return {
        status: true,
        statusCode: constants.STATUS.SUCCESS,
        data: {
          data: "Transaction Processing"
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
    console.log(" :: CREATE_MARKET_ITEM ERROR :: ", error)

    return {
      status: false,
      statusCode: constants.STATUS.INTERNAL_SERVER_ERROR,
      data: {
        data: "Internal Server Error"
      }
    }

  }
};

// C H E C K    A C C O U N T    B A L A N C E
const checkBalance = async (
  email,
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

  transactionFee = (gasPrice * (gasLimit));
  console.log(":: TXN FEE :: ", transactionFee);

  balance = Number(actualBalance) - Number(transactionFee);
  console.log(":: BALANCE :: ", balance);

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
      gasLimit: gasLimit,
      gasPrice: gasPrice
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
const createMarketSale = async (email, tokenId, price) => {
  try {
    let promises = await Promise.all([
      initializeWeb3(),
      initializeMarketContract(await initializeSigner(email)),
      accountsModel.findOne({ email: email }).lean().exec(),
      walletsModel.findOne({ email: email }).lean().exec(),
      nftsModel.findOne({ tokenId: tokenId }).lean().exec()
    ]);

    //CHECK WALLET BALANCE
    let balance = await checkBalance(email, Number(price));
    console.log("BALANCE", balance);

    if (balance.status) {

      let transactionFee;

      transactionFee = Number(balance.gasLimit) * Number(balance.gasPrice);

      await transactionsModel.create({
        email: email,
        ref: promises[2].ref,
        from: promises[3].bnb.address,
        to: marketContractAddress,
        source: 'bnb',
        target: 'bnb',
        sourceAmount: price,
        targetAmount: price,
        type: "send",
        currency: 'bnb',
        method: "createMarketSale",
        auctionPrice: price,
        hash: "",
        status: constants.TXNS.IN_QUEUE,
        error: "nil",
        itemId: promises[4].itemId,
        gasLimit: balance.gasLimit,
        gasPrice: balance.gasPrice,
        fee: String(transactionFee),
        timestamp: String(new Date().getTime())
      });

      return {
        status: true,
        statusCode: constants.STATUS.SUCCESS,
        data: {
          data: "Transaction Processing"
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

    console.log(":: CREATE_MARKET_SALE :: ERROR :: ", error);

    return {
      status: false,
      statusCode: constants.STATUS.INTERNAL_SERVER_ERROR,
      data: {
        data: "Internal Server Error"
      }
    }

  }
};

// CREATE MARKET SALE - BUY NFT
const createMarketSales = async (email) => {
  try {
    let promises = await Promise.all([
      initializeWeb3(),
      initializeMarketContract(await initializeSigner(email)),
      accountsModel.findOne({ email: email }).lean().exec(),
      initializeTokenContract(await initializeSigner(email))
    ]);

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
            itemId: i.itemId.toNumber(),
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

// UNLISTED TOKENS
const tokens = async (email) => {

  try {

    let tokens = await nftsModel.find(
      {
        $and: [
          {
            email: email
          },
          {
            seller: '0x0000000000000000000000000000000000000000'
          },
          {
            active: false
          },
          {
            market: false
          }
        ]
      },
      {
        _id: 0,
        tokenId: 1,
        metadata: 1
      }
    ).sort({ timestamp: -1 })
      .lean()
      .exec();


    return {
      status: true,
      statusCode: constants.STATUS.SUCCESS,
      data: {
        data: tokens
      }
    };

  } catch (error) {

    console.log(" :: TOKENS :: ", error);

    return {
      status: false,
      statusCode: constants.STATUS.INTERNAL_SERVER_ERROR,
      data: {
        data: "Internal Server Error"
      }
    };

  }

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

// MARKET ITEMS
const marketItems = async (email) => {

  try {

    let marketItems = await nftsModel.find({
      $and: [
        {
          email: {
            $ne: email
          }
        },
        {
          sold: false
        },
        {
          market: true
        },
        {
          active: true
        }
      ]
    },
      {
        _id: 0,
        tokenId: 1,
        metadata: 1,
        price: 1
      }).sort({ timestamp: -1 })
      .lean()
      .exec();

    return {
      status: true,
      statusCode: constants.STATUS.SUCCESS,
      data: {
        data: marketItems
      }
    };

  } catch (error) {

    return {
      status: false,
      statusCode: constants.STATUS.INTERNAL_SERVER_ERROR,
      data: {
        data: "Internal Server Error"
      }
    };

  }

}

// OWNED ITEMS
const ownedItems = async(email) => {

  try {

    let walletAddress = (await walletsModel.findOne({email:email}).exec()).bnb.address;

    let ownedItems = await nftsModel.find({
      $and:[
        {
          owner:walletAddress
        },
        {
          sold: true
        }
      ]
    },
    {
      _id: 0,
      tokenId: 1,
      metadata: 1,
      price:1
    }).sort({ timestamp: -1 })
      .lean()
      .exec();
    
    return {
      status: true,
      statusCode: constants.STATUS.SUCCESS,
      data: {
        data: ownedItems
      }
    };

  } catch (error) {
    
    return {
      status: false,
      statusCode: constants.STATUS.INTERNAL_SERVER_ERROR,
      data: {
        data: "Internal Server Error"
      }
    };

  }

}

// CREATED ITEMS
const createdItems = async(email) => {

  try {

    let walletAddress = (await walletsModel.findOne({email:email}).exec()).bnb.address;

    let createdItems = await nftsModel.find({
      $and:[
        {
          seller:walletAddress
        },
        {
          active: true
        },
        {
          market: true
        }
      ]
    },
    {
      _id: 0,
      tokenId: 1,
      metadata: 1,
      price:1
    }).sort({ timestamp: -1 })
      .lean()
      .exec();
    
    return {
      status: true,
      statusCode: constants.STATUS.SUCCESS,
      data: {
        data: createdItems
      }
    };

  } catch (error) {
    
    return {
      status: false,
      statusCode: constants.STATUS.INTERNAL_SERVER_ERROR,
      data: {
        data: "Internal Server Error"
      }
    };

  }

}

module.exports = {
  uploadFileToIPFS,
  createToken,
  createMarketItem,
  createMarketSale,
  fetchMarketItems,
  fetchMyNFTs,
  fetchItemsCreated,
  metadata,
  tokens,
  marketItems,
  ownedItems,
  createdItems
};
