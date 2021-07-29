const ethers = require("ethers");
const wallet_library = require("../blockchain/wallet");
var provider;

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
const createWallets = async () => {
  try {
    let ref = 11;

    console.log("REF :: ", ref);

    let ethWallet = await wallet_library.generateEthereumAddress(ref, true);

    let wallet = {
      eth: await wallet_library.toCheckSumAddress(ethWallet.address),
      usdt: await wallet_library.toCheckSumAddress(ethWallet.address),
    };

    console.log("WALLET :: ", wallet);

    return {
      wallet,
      ref,
    };
  } catch (error) {
    console.log(error);
  }
};

// C H E C K    A C C O U N T    B A L A N C E
const checkBalance = async (crypto, address) => {
  
  let balance;

  await initializeWeb3();

  if (crypto == "ETH") {
    
    balance = await provider.getBalance(address);

    balance = (await ethers.utils.formatEther(balance)).toString();

  } else {
    return
  }

  return balance;


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

module.exports = {
  initializeWeb3,
  createWallets,
  checkBalance,
  isAddressValid,
  toCheckSumAddress
};
