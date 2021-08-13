const express = require("express");
const router = express.Router();
const ethereum_lib = require("../lib/crypto/ethereum");
const ethers = require("ethers");
const jwt_lib = require("../lib/server/jwt");
const cache_lib = require("../lib/server/cache");
const bcrypt_lib = require("../lib/server/bcrypt");
const accountsModel = require("../models/accounts");
const walletsModel = require("../models/wallets");
const transactionsModel = require("../models/transactions");
const settingsModel = require("../models/settings");
const constants = require("../constants/constants");
var provider;

// - api key only

// ACTIVATE ACCOUNT
router.post("/activateAccount", async (req, res, next) => {
  try {

    let token = await jwt_lib.generateToken();

    return res.status(200).send({
      status: true,
      token: token,
    });
  } catch (error) {
    console.log("ACTIVATE ACCOUNT :: ", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

// CREATE NEW WALLETS - ETH & ERC20 TOKENS
router.get("/createWallet", async (req, res, next) => {
  try {
    let { email, password } = req.body;

    let wallet_data = await createWallet(email, req.body);

    // let token = await jwt_lib.generateToken();

    if(wallet_data.status == true) {
      return res.status(200).send({
        status: true,
        // token: token,
        message: "success"
      });
    }
    else{
      return res.status(400).send({
        status: false,
        message: wallet_data.message,
      });
    }



  } catch (error) {
    console.log("ERROR :: ", error);

    return res.status(500).send({
      message: "Internal Server Error",
      status: false,
    });
  }
});

// MIDDLEWARE TOKEN AUTHENTICATION
// router.use(jwt_lib.router);

router.get("/send", async (req, res, next) => {
  try {

    let { email, crypto, receiver, amount } = req.body;

    let walletInfo = await walletsModel.findOne({email:email}).lean().exec();

    let address = walletInfo[crypto.toLowerCase()].address;

    let balance = walletInfo[crypto.toLowerCase()].balance;

    console.log("walel",address,crypto,balance)

    // let balance = await ethereum_lib.checkBalance( crypto, address);
    let checkBalance = await ethereum_lib.checkBalance(
      email,
      crypto,
      balance,
      address,
      receiver,
      amount
    );
    
    console.log("asfd",checkBalance)

    if(checkBalance.status) {
     
      await transactionsModel.create({
        email: email,
        ref: walletInfo.id,
        from: email,
        to: receiver,
        source: crypto.toLowerCase(),
        target: crypto.toLowerCase(),
        sourceAmount: amount,
        targetAmount:amount,
        type: "send",
        currency: crypto.toLowerCase(),
        hash: '',
        status: constants.TXNS.IN_QUEUE,
        error: 'nil',
        gasLimit: checkBalance.gasLimit,
        gasPrice: checkBalance.gasPrice,
        fee: checkBalance.fee,
        timestamp: String(new Date().getTime())
      })

      return res.status(200).send({
        status: true,
        message: "Transaction Initiated"
      });

    }
    else {

      return res.status(400).send({
        status: false,
        message: "Insufficient Balance"
      });

    }

  } catch (error) {

    console.log("ERROR::SEND::",error);

    return res.status(500).send({
      message: "Internal Server Error",
      status: false,
    });
  }
});

// SET DIFFERENT TRANSACTION FEE 
router.get("/transactionFee", async(req,res) => {

  try {
    


  } catch (error) {
    
    console.log("::TRANSACTION FEE::ERROR::",error);
    return res.status(500).send({
      status: false,
      message: "Internal Server Error"
    })

  }

})


// CREATE CRYPTO ADDRESSESS FOR NEW USERS
const createWallet = async (email, userData) => {
  try {
    console.log("ASfasfas");

    let lastRef;

    let result = await accountsModel
      .find({ adminLevel: { $nin: ["0"] } })
      .sort({ ref: -1 });


    if (result.length > 0) {
      console.log("Lastre");
      lastRef = result[0].ref;
    } else {
      console.log("asfasfa");

      lastRef = 50;
    }

    let ref = lastRef + 1;

    console.log("REF_NO::", ref);

    let ethereum_wallet = await ethereum_lib.createWallets(ref);

    let wallet = {
      eth: ethereum_wallet,
      usdt: ethereum_wallet
    };

    userData.wallets = wallet;

    let block_balance = {
      eth: '0',
      usdt: '0'
    }

    await accountsModel.create({
      email: email,
      password: String(await bcrypt_lib.hash(userData.password)),
      id: email,
      ref: ref
    });

    await walletsModel.create({
      email: email,
      id: ref,
      eth: {
        balance: block_balance.eth,
        address: wallet.eth,
        fee: 0,
      },
      usdt: {
        balance: block_balance.usdt,
        address: wallet.usdt,
        fee: 0,
      }
    });

    return {
      status: true,
      message: "success"
    }

  } catch (error) {

    console.log("ERROR::",error);

    return {
      status: false,
      message: error.code == 11000 ? "Duplicate Entry Found" : "Error"
    }

  }
};

// CHECK IS EXTERNAL ADDRESS
const isExternalAddress = async(crypto, address) => {

  try {
    
    let flag = true;

		let account = await walletsModel.find({}).lean().exec();

		await account.forEach(async result => {
      console.log("wetr",result.eth.address)
			if (result.wallets[`${crypto.toLowerCase()}.address`] == address) {
        
        flag = false
        console.log("FLAG::",flag);

			}
    });
    
    return flag;

  } catch (error) {
    
    console.log("ERROR::",error);

  }

} 

// isExternalAddress("ETH","0xEc51E8E9ac545281794AF5488b348CA9b62b1059");

module.exports = router;
