const ethers = require("ethers");
const axios = require("axios");
const wallet_library = require("../blockchain/wallet");
const walletsModel = require("../../models/wallets");
var provider;
const testUrl = "https://api-ropsten.etherscan.io/";
const productionUrl = "https://api.etherscan.io/";

// I N I T I A L I Z E    W E B 3
const initializeWeb3 = async () => {
  try {
    var url = "https://ropsten.infura.io/v3/a478bf40f7b24494b30b082c0d225104";
    provider = new ethers.providers.JsonRpcProvider(url);
    // console.log("PROVIDER :: ",provider);
  } catch (error) {
    console.log("INFURA ERROR :: ", error);
    throw new Error(error.message);
  }
};

// W A L L E T    G E N E R A T I O N
const createWallets = async (ref) => {
  try {

    console.log("REF :: ", ref);

    let ethWallet = await wallet_library.generateEthereumAddress(ref, true);

    let wallet = await toCheckSumAddress(ethWallet.address)

    console.log("WALLET :: ", wallet);

    return toCheckSumAddress(wallet);
    
  } catch (error) {
    console.log(error);
  }
};

// C H E C K    A C C O U N T    B A L A N C E
const checkBalance = async (crypto, balance, address, receiver, amount) => {

  await initializeWeb3();

  if (crypto == "ETH") {

    console.log("ADDRESS :: ",address);

    let gasPrice = (await provider.getGasPrice());
    console.log("gasPrices",typeof(await provider.getGasPrice()))
    let gas_price = await ethers.utils.formatEther(gasPrice.toNumber())

    let gasLimit = (await provider.estimateGas({
      to: receiver,
      value: ethers.utils.parseEther(amount)
    }))

    console.log("GAS PRICE :: ",gas_price);
    console.log("GAS LIMIT",gasLimit);

    let transactionFee = gas_price * gasLimit.toNumber();
    console.log("TXN FEE :: ", transactionFee);

    balance = Number(balance) - Number(transactionFee);
    console.log("BALANCE :: ",balance);

    if( amount < balance ){
      
      return {
        status: true,
        fee: transactionFee,
        gasLimit: gasLimit,
        gasPrice: gasPrice
      };
    
    }
    else{
    
      return {
        status: false,
        fee: 0
      };
    
    }
    
  } else {
    return
  }

};

// V A L I D A T E    A D D R E S S
const isAddressValid = async(crypto, address) => {

    switch (crypto) {
        case 'ETH':
            return await ethers.utils.isAddress(address); 
            break;

        default:
            return false;
            break;
    }

}

// C O N V E R T    T O    C H E C K S U M    A D D R E S S
const toCheckSumAddress = async(address) => {
    
  var checkSumAddress = await ethers.utils.getAddress(address);
  return checkSumAddress;

}

// RETREIVE CONTRACT ABI OF VERIFIED CONTRACT
const contractABI = async(contract, apiKey) => {

  try {
      
      const url = `${testUrl}/api?module=contract&action=getabi&address=${contract}&apikey=${apiKey}`;
      
      const config = {
          method: "GET",
          url: url,
        };
    
        const response = await axios(config);

        console.log("response",response.data);

        return {
            status: response.data.status,
            message: response.data.message, // message -> "OK"(status - '1') OR "NOTOK"(status - '0')
            result: response.data.result
        }

  } catch (error) {
      
      console.log("::CONTRACT_ABI::ERROR",error);

      return;

  }

}

// contractABI("0x75A471613aC0B0Ed0fCe30FdD45a649eE4542be5","IP3C2JRFFU14ER43G1N5BJXC6HI8BWPT9F");

// C A L C U L A T E    D E F A U L T    G A S F E E
const requestPromise = require('request-promise');

const gasFee = async() => {
  let GaspriceData = await requestPromise.get(
    "https://ethgasstation.info/api/ethgasAPI.json?api-key=aae2c9ad98fa8e39104f45d6df55dc199fb957eaac16e289f3aa8c57c8b9",
    {
      method: "GET",
    }
  );
  // console.log(GaspriceData);

  GaspriceData = JSON.parse(GaspriceData);
  console.log("saf",GaspriceData)
  let Gasprice = String(Number(GaspriceData.average) * 10 ** 8);
  console.log("asda",Gasprice);
  
}

// gasFee();

module.exports = {
  initializeWeb3,
  createWallets,
  checkBalance,
  isAddressValid,
  toCheckSumAddress
};
