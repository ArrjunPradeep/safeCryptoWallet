const express = require("express");
const router = express.Router();
const ethereum_lib = require("../lib/crypto/ethereum");
const jwt_lib = require("../lib/server/jwt");
const cache_lib = require("../lib/server/cache");
const bcrypt_lib = require("../lib/server/bcrypt");
const accountsModel = require("../models/accounts");
const walletsModel = require("../models/wallets");
const tokensModel = require("../models/tokens");
const transactionsModel = require("../models/transactions");
const constants = require("../constants/constants");

// MIDDLEWARE API-KEY AUTHENTICATION
router.use(jwt_lib.router);

// ACTIVATE ACCOUNT
router.post("/activateAccount", async (req, res, next) => {
  try {

    let token = "srfsdgf";

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

// CREATE NEW WALLETS - BNB & TOKENS
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

// SEND COIN & TOKEN 
router.post("/send", async (req, res, next) => {
  try {

    let { email, crypto, receiver, amount } = req.body;

    let promises = await Promise.all([
      walletsModel.findOne({email:email}).lean().exec(),
      tokensModel.findOne({symbol:crypto}).lean().exec()
    ])

    if(promises[1] == null && crypto != 'BNB') {

      return res.status(401).send({
        status:false,
        message:"Invalid Token"
      })

    }

    let balance = promises[0][crypto.toLowerCase()].balance;

    let checkBalance = await ethereum_lib.checkBalance(
      email,
      crypto,
      balance,
      amount
    );
    
    if(checkBalance.status) {
     
      await transactionsModel.create({
        email: email,
        ref: promises[0].id,
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
})

// VALIDATE THE TRANSACTION 
router.post("/validateTransaction", async(req, res, next) => {

  try {
    
    let { email, crypto, amount } = req.body;

    let promises = await Promise.all([
      walletsModel.findOne({email:email}).lean().exec(),
      tokensModel.findOne({symbol:crypto}).lean().exec()
    ])

    if(promises[1] == null && crypto != 'BNB') {

      return res.status(401).send({
        status:false,
        message:"Invalid Token"
      })

    }

    let balance = promises[0][crypto.toLowerCase()].balance;

    let checkBalance = await ethereum_lib.validateTransaction(
      crypto,
      balance,
      amount
    );
    
    if(checkBalance.status) {
     
      return res.status(200).send({
        status: true,
        message: "CONFIRM"
      });

    }
    else {

      return res.status(400).send({
        status: false,
        message: "INSUFFICIENT BALANCE"
      });

    }

  } catch (error) {
    
    console.log(":: ERROR ::", error);

    return res.status(500).send({
      status:false,
      message:"Internal Server Error"
    })

  }

})

// RETREIVE TRANSACTION HISTORY
router.get("/transactionHistory", async(req,res) => {

  try {
    
    let sendTransactions = await transactionsModel.find({email:req.query.email,type:"send"},{
      source: 1,
      sourceAmount: 1,
      targetAmount: 1,
      type: 1,
      status: 1,
      timestamp: 1,
      to: 1,
      hash: 1,
      _id:0
    }).sort({timestamp:-1}).lean().exec();
    
    let receiveTransactions = await transactionsModel.find({email:req.query.email,type:"received"},{
      source: 1,
      sourceAmount: 1,
      targetAmount: 1,
      type: 1,
      status: 1,
      timestamp: 1,
      from: 1,
      hash: 1,
      _id:0
		}).sort({timestamp:-1}).lean().exec();

    return res.status(200).send({
      status: true,
      message: {
        send:sendTransactions,
        receive:receiveTransactions
      }
    })


  } catch (error) {
    
    console.log("::TRANSACTION HISTORY::ERROR::",error);
    return res.status(500).send({
      status: false,
      message: "Internal Server Error"
    })

  }

})

// RETREIVE USER DETAILS
router.get("/user", async ( req, res, next) => {

  try {

    let { email } = req.query;

    console.log("QUERY::", email);

    let user = await walletsModel.findOne({email:email},{_id:0,id:0,__v:0}).lean().exec();
    
    return res.status(200).send({
      status:true,
      message:user
    })

  } catch (error) {
    
    console.log("::USER::ERROR::", error);

    return res.status(500).send({
      status:false,
      message:"Internal Server Error"
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
      bnb: ethereum_wallet,
      bobe: ethereum_wallet
    };

    userData.wallets = wallet;

    let block_balance = {
      bnb: '0',
      bobe: '0'
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
      bnb: {
        balance: block_balance.bnb,
        address: wallet.bnb,
        fee: 0,
      },
      bobe: {
        balance: block_balance.bobe,
        address: wallet.bobe,
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
      console.log("wetr",result.bnb.address)
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

module.exports = router;
