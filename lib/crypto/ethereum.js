const ethers = require("ethers");
const axios = require("axios");
const wallet_library = require("../blockchain/wallet");
const accountsModel = require("../../models/accounts");
const walletsModel = require("../../models/wallets");
const tokensModel = require("../../models/tokens");
const config = require("../../config/config");
var provider;
var contract_abi = require("../../contract/abi").abi;
// const testUrl = "https://api-ropsten.etherscan.io/";
// const productionUrl = "https://api.etherscan.io/";
// etherscan : {
//   apiKey: 'IP3C2JRFFU14ER43G1N5BJXC6HI8BWPT9F'
// },

// bscscan : {
//   apiKey: 'ZH8ZNRHSX9TCAAJDAVGXJRCRZBYFU5X1R4'
// },


// I N I T I A L I Z E    W E B 3
const initializeWeb3 = async () => {
  try {
    var url = config.wallet.provider;
    provider = new ethers.providers.JsonRpcProvider(url);
  } catch (error) {
    console.log("INFURA ERROR :: ", error);
    throw new Error(error.message);
  }
};

// W A L L E T    G E N E R A T I O N
const createWallets = async (ref) => {
  try {
    console.log("REF :: ", ref);

    let cryptoWallet = await wallet_library.generateAddress(ref, true);

    let wallet = await toCheckSumAddress(cryptoWallet.address);

    console.log("WALLET :: ", wallet);

    return toCheckSumAddress(wallet);
  } catch (error) {
    console.log(error);
  }
};

// C H E C K    A C C O U N T    B A L A N C E
const checkBalance = async (
  email,
  crypto,
  balance,
  amount
) => {

  let transactionFee, gasLimit, gasPrice;

  gasLimit = Number(config.wallet.gasLimit);

  gasPrice = Number(config.wallet.gasPrice);
  
  console.log(":: GAS PRICE :: ", gasPrice);

  console.log(":: GAS LIMIT ::", gasLimit);

  if (crypto == "BNB") {

    transactionFee = gasPrice * gasLimit;
    console.log(":: TXN FEE :: ", transactionFee);

    balance = Number(balance) - Number(transactionFee);
    console.log(":: BALANCE :: ", balance);

  } else {

    console.log(":: CRYPTO :: ", crypto);

    let token_info, token_decimal, token_amount;

    await Promise.all([
      token_info = tokensModel.findOne({symbol:crypto}).lean().exec(),
      token_amount = ethers.utils.parseUnits(amount, token_info.decimal)
    ])

    console.log(":: AMOUNT :: ", token_amount.toString());

    transactionFee = gasPrice * gasLimit;
    console.log(":: TXN FEE :: ", transactionFee);

    balance = Number(balance) 
    // - Number(transactionFee);
    console.log(":: BALANCE :: ", balance);

  }

  if (amount < balance) {

    if(crypto == "BNB"){

      let resultantBalance = Number(balance) - Number(amount)

      await walletsModel.updateOne(
        {
          email: email,
        },
        {
          $set: {
            [`${crypto.toLowerCase()}.balance`]: String(resultantBalance)
          },
        }
      );

    } 
    else {

      let walletInfo = await walletsModel.findOne({email:email}).lean().exec();
  
      let bnbBalance = walletInfo.bnb.balance;

      let resultantBnbBalance = Number(bnbBalance) - Number(transactionFee)

      await walletsModel.updateOne(
        {
          email: email,
        },
        {
          $set: {
            'bnb.balance': String(resultantBnbBalance),
          },
        }
      );

      let resultantTokenBalance = Number(balance) - Number(amount)

      await walletsModel.updateOne(
        {
          email: email,
        },
        {
          $set: {
            [`${crypto.toLowerCase()}.balance`]: String(resultantTokenBalance),
          },
        }
      );

    }

    return {
      status: true,
      fee: transactionFee,
      gasLimit: gasLimit,
      gasPrice: gasPrice,
    };

  } else {
    return {
      status: false
    };
  }
};

// V A L I D A T E    A D D R E S S
const isAddressValid = async (address) => {

  return await ethers.utils.isAddress(address);
  // switch (crypto) {
  //   case "BNB":
  //     return await ethers.utils.isAddress(address);
  //     break;

  //   default:
  //     return false;
  //     break;
  // }
};

// C O N V E R T    T O    C H E C K S U M    A D D R E S S
const toCheckSumAddress = async (address) => {
  var checkSumAddress = await ethers.utils.getAddress(address);
  return checkSumAddress;
};

// R E T U R N    D E C I M A L S    O F    C O N T R A C T
const tokenDecimal = async(address) => {

  try {

    await initializeWeb3();

    const token = new ethers.Contract(
      address,
      contract_abi,
      provider
    );

    let token_decimal = await token.decimals();

    return {
      status: true,
      decimal: token_decimal
    }

  } catch (error) {

    return {
      status:false
    }

    console.log(":: TOKEN DECIMAL ERROR ::", error);
    
  }

}

// V A L I D A T E    T R A N S A C T I O N 
const validateTransaction = async (
  crypto,
  balance,
  amount
) => {

  let transactionFee, gasLimit, gasPrice;

  gasLimit = Number(config.wallet.gasLimit);

  gasPrice = Number(config.wallet.gasPrice);
      
  console.log(":: GAS PRICE :: ", gasPrice);

  console.log(":: GAS LIMIT ::", gasLimit);

  if (crypto == "BNB") {

    transactionFee = gasPrice * gasLimit;
    console.log(":: TXN FEE :: ", transactionFee);

    balance = Number(balance) - Number(transactionFee);
    console.log(":: BALANCE :: ", balance);

  } else {

    console.log(":: CRYPTO :: ", crypto);

    let token_info, token_decimal, token_amount;

    await Promise.all([
      token_info = tokensModel.findOne({symbol:crypto}).lean().exec(),
      token_amount = ethers.utils.parseUnits(amount, token_info.decimal)
    ])

    console.log(":: AMOUNT :: ", token_amount.toString());

    transactionFee = gasPrice * gasLimit;
    console.log(":: TXN FEE :: ", transactionFee);

    balance = Number(balance) 
    // - Number(transactionFee);
    console.log(":: BALANCE :: ", balance);

  }

  if (amount < balance) {

    return {
      status: true,
      fee: transactionFee,
      gasLimit: gasLimit,
      gasPrice: gasPrice,
    };

  } else {
    return {
      status: false
    };
  }
};

// RETREIVE CONTRACT ABI OF VERIFIED CONTRACT
// const contractABI = async (contract, apiKey) => {
//   try {
//     const url = `${testUrl}/api?module=contract&action=getabi&address=${contract}&apikey=${apiKey}`;

//     const config = {
//       method: "GET",
//       url: url,
//     };

//     const response = await axios(config);

//     console.log("response", response.data);

//     return {
//       status: response.data.status,
//       message: response.data.message, // message -> "OK"(status - '1') OR "NOTOK"(status - '0')
//       result: response.data.result,
//     };
//   } catch (error) {
//     console.log("::CONTRACT_ABI::ERROR", error);

//     return;
//   }
// };

// contractABI("0x75A471613aC0B0Ed0fCe30FdD45a649eE4542be5","IP3C2JRFFU14ER43G1N5BJXC6HI8BWPT9F");

// C A L C U L A T E    D E F A U L T    G A S F E E
// const requestPromise = require("request-promise");

// const gasFee = async () => {
//   let GaspriceData = await requestPromise.get(
//     "https://ethgasstation.info/api/ethgasAPI.json?api-key=aae2c9ad98fa8e39104f45d6df55dc199fb957eaac16e289f3aa8c57c8b9",
//     {
//       method: "GET",
//     }
//   );
//   // console.log(GaspriceData);

//   GaspriceData = JSON.parse(GaspriceData);
//   console.log("saf", GaspriceData);
//   let Gasprice = String(Number(GaspriceData.average) * 10 ** 8);
//   console.log("asda", Gasprice);
// };


module.exports = {
  initializeWeb3,
  createWallets,
  checkBalance,
  isAddressValid,
  toCheckSumAddress,
  tokenDecimal,
  validateTransaction
};