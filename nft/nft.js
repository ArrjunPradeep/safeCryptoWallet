const ethers = require("ethers");
const axios = require("axios");
const { create } = require("ipfs-http-client");
const tokenABI = require("../artifacts/contracts/NFT.sol/NFT.json").abi;
const marketABI =
  require("../artifacts/contracts/NFTMarket.sol/NFTMarket.json").abi;
const config = require('../config/config');
const accountsModel = require("../models/accounts");
const wallet_library = require('../lib/blockchain/wallet');

var client, provider, tokenContract, marketContract, signerAddress;

const tokenContractAddress = "0xD4F18596128f134ff64B7974FFD82fD626132127" //"0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const marketContractAddress = "0x1A842e10cddc551E943B1bfc3F9E0B733Eb669Dd" //"0x5FbDB2315678afecb367f032d93F642f64180aa3";

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
const initializeWeb3 = async (signer) => {
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
    // console.log("WALLET ::", wallet.address);

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
    await Promise.all([
      initializeWeb3(),
      initializeTokenContract(await initializeSigner(email)),
    ]);

    const data = await tokenContract.createToken(URI);

    let tx = await data.wait();

    let event = tx.events[2];

    let value = event.args[1].toString();

    return value;
  } catch (error) {

    if (error.code) {
      return { error: error.code };
    }

    console.log(":: CREATE_NFT :: ERROR :: ", error);

    return;
  }
};

// CREATE MARKET ITEM - CREATE NFT
const createMarketItem = async (email, URI, price) => {
  try {
    await Promise.all([
      initializeWeb3(),
      initializeTokenContract(await initializeSigner(email)),
      initializeMarketContract(await initializeSigner(email))
    ]);
    console.log("Fasfasf", email)

    // RETRIEVE THE TOKEN ID OF NEW NFT
    let tokenId = await createNFT(email, URI);

    // LISTING & AUCTION PRICE
    const listingPrice = await marketContract.getListingPrice();
    const auctionPrice = await ethers.utils.parseUnits(price, "ether");

    // LIST A NEW NFT
    let data = await marketContract.createMarketItem(
      tokenContractAddress,
      tokenId,
      auctionPrice,
      { value: listingPrice }
    );


    let tx = await data.wait();
    let event = tx.events[2];
    let item = {
      itemId: event.args[0].toString(),
      tokenId: event.args[2].toString(),
      price: event.args[5].toString(),
    };

    return item;
  } catch (error) {

    if (error.code) {
      return { error: error.code };
    }

    let err = JSON.parse(error.error.body).error.message;
    err = err.substring(err.indexOf("'") + 1, err.lastIndexOf("'"));

    console.log(":: CREATE_MARKET_ITEM :: ERROR :: ", err);

    return { error: err };
  }
};

// CREATE MARKET SALE - BUY NFT
const createMarketSale = async (email, tokenId, price) => {
  try {
    await Promise.all([
      initializeWeb3(),
      initializeMarketContract(await initializeSigner(email)),
    ]);

    // LISTING & AUCTION PRICE
    const auctionPrice = await ethers.utils.parseUnits(price, "ether");

    // LIST A NEW NFT
    let data = await marketContract.createMarketSale(
      tokenContractAddress,
      Number(tokenId),
      { value: auctionPrice }
    );
    let tx = await data.wait();
    let event = tx.events[2];
    let item = {
      itemId: event.args[0].toString(),
      tokenId: event.args[2].toString(),
      price: event.args[5].toString(),
    };

    return item;
  } catch (error) {

    if (error.code) {
      return { error: error.code };
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

module.exports = {
  uploadFileToIPFS,
  createMarketItem,
  createMarketSale,
  fetchMarketItems,
  fetchMyNFTs,
  fetchItemsCreated
};
