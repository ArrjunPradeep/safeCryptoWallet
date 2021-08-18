const ethers = require("ethers");
const axios = require("axios");
const wallet_library = require("../blockchain/wallet");
const accountsModel = require("../../models/accounts");
const walletsModel = require("../../models/wallets");
const settingsModel = require("../../models/settings");
var provider;
var contract_abi = require("../../contract/abi").abi;
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

    let wallet = await toCheckSumAddress(ethWallet.address);

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
  address,
  receiver,
  amount
) => {
  await initializeWeb3();

  let transactionFee, gasLimit, gasPrice;

  gasPrice = await provider.getGasPrice();

  gasPrice = await ethers.utils.formatEther(gasPrice);

  console.log(":: GAS PRICE :: ", gasPrice);

  if (crypto == "ETH") {
    console.log("ADDRESS :: ", address);

    gasLimit = await provider.estimateGas({
      to: receiver,
      value: ethers.utils.parseEther(amount),
    });

    gasLimit = gasLimit.toNumber();

    console.log(":: GAS LIMIT ::", gasLimit);

    transactionFee = gasPrice * gasLimit;
    console.log(":: TXN FEE :: ", transactionFee);

    balance = Number(balance) - Number(transactionFee);
    console.log("BALANCE :: ", balance);

  } else {
    console.log("CRYPTO::", crypto);

    let account = await accountsModel.findOne({ email: email }).lean().exec();

    await initializeWeb3();

    let privateKey = await (
      await wallet_library.generateEthereumAddress(account.ref, true)
    ).privateKey;

    let wallet = new ethers.Wallet(privateKey, provider);
    console.log("WALLET ::", wallet.address);

    let walletSigner = wallet.connect(provider);
    console.log("SIGNER ::", walletSigner.address);

    let contractAddress = "0x75A471613aC0B0Ed0fCe30FdD45a649eE4542be5";

    const erc20 = new ethers.Contract(
      contractAddress,
      contract_abi,
      walletSigner
    );

    let erc20_decimal = await erc20.decimals();

    let token_amount = await ethers.utils.parseUnits("1", erc20_decimal);

    console.log("ERC20::", token_amount.toString());

    gasLimit = await erc20.estimateGas.transfer(
      receiver,
      token_amount
    ).toNumber();

    console.log("GAS LIMIT", gasLimit);

    transactionFee = gasPrice * gasLimit;
    console.log("TXN FEE :: ", transactionFee);

    balance = Number(balance) 
    // - Number(transactionFee);
    console.log("BALANCE :: ", balance);

  }

  if (amount < balance) {

    if(crypto == "ETH"){

      let resultantBalance = Number(balance) - Number(amount)

      let db = await walletsModel.updateOne(
        {
          email: email,
        },
        {
          $set: {
            [`${crypto.toLowerCase()}.balance`]: String(resultantBalance)
          },
        }
      );

      console.log("DB",db)

    } 
    else {

      let walletInfo = await walletsModel.findOne({email:email}).lean().exec();
  
      let ethBalance = walletInfo.eth.balance;

      let resultantEthBalance = Number(ethBalance) - Number(transactionFee)

      await walletsModel.updateOne(
        {
          email: email,
        },
        {
          $set: {
            'eth.balance': String(resultantEthBalance),
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
      status: false,
      fee: 0,
    };
  }
};

// V A L I D A T E    A D D R E S S
const isAddressValid = async (crypto, address) => {
  switch (crypto) {
    case "ETH":
      return await ethers.utils.isAddress(address);
      break;

    default:
      return false;
      break;
  }
};

// C O N V E R T    T O    C H E C K S U M    A D D R E S S
const toCheckSumAddress = async (address) => {
  var checkSumAddress = await ethers.utils.getAddress(address);
  return checkSumAddress;
};

// RETREIVE CONTRACT ABI OF VERIFIED CONTRACT
const contractABI = async (contract, apiKey) => {
  try {
    const url = `${testUrl}/api?module=contract&action=getabi&address=${contract}&apikey=${apiKey}`;

    const config = {
      method: "GET",
      url: url,
    };

    const response = await axios(config);

    console.log("response", response.data);

    return {
      status: response.data.status,
      message: response.data.message, // message -> "OK"(status - '1') OR "NOTOK"(status - '0')
      result: response.data.result,
    };
  } catch (error) {
    console.log("::CONTRACT_ABI::ERROR", error);

    return;
  }
};

// contractABI("0x75A471613aC0B0Ed0fCe30FdD45a649eE4542be5","IP3C2JRFFU14ER43G1N5BJXC6HI8BWPT9F");

// C A L C U L A T E    D E F A U L T    G A S F E E
const requestPromise = require("request-promise");

const gasFee = async () => {
  let GaspriceData = await requestPromise.get(
    "https://ethgasstation.info/api/ethgasAPI.json?api-key=aae2c9ad98fa8e39104f45d6df55dc199fb957eaac16e289f3aa8c57c8b9",
    {
      method: "GET",
    }
  );
  // console.log(GaspriceData);

  GaspriceData = JSON.parse(GaspriceData);
  console.log("saf", GaspriceData);
  let Gasprice = String(Number(GaspriceData.average) * 10 ** 8);
  console.log("asda", Gasprice);
};

// gasFee();

module.exports = {
  initializeWeb3,
  createWallets,
  checkBalance,
  isAddressValid,
  toCheckSumAddress,
};
