const express = require('express');
const router = express.Router();
const ethereum_lib = require('../lib/ethereum/functions');
const ethers = require('ethers');
const jwt_lib = require('../lib/server/jwt');
const wallet_library = require('../lib/blockchain/wallet');
var provider;

router.get('/login',async(req,res,next) => {

	let token = await jwt_lib.generateToken()

	return res.status(200).send({
		status:true,
		token:token
	})

})

router.use(jwt_lib.router);

router.get('/success',async(req,res,next) => {

	try {
		return res.status(200).send({
			status:true,
			token:"token"
		})
	} catch (error) {
		return res.status(200).send({
			status:false,
			token:"err"
		})
	}

})

// CREATE NEW WALLETS - ETH & ERC20 TOKENS
router.get('/createWallet', async (req, res, next) => {
  
  try {

	let { email, password } = req.body;
    
    let wallet_data = await ethereum_lib.createWallets();

    return res.status(200).send({
      data : wallet_data,
      status:true
    })

    
  } catch (error) {
    return res.status(500).send({
      message:"Internal Server Error",
      status:false
    })
  }

});


router.get('/send', async(req, res, next) => {

	try {

		let { crypto, receiver, amount  } = req.body;
		
		// let balance = await ethereum_lib.checkBalance( crypto, address);
		let balance = await ethereum_lib.checkBalance("ETH","0x8ba1f109551bd432803012645ac136ddd64dba72");

		if(amount > balance || amount == '0') {
			
			return res.status(422).send({
				status:false,
				message:"Insufficient Balance"
			});

		}

		return res.status(200).send({
			status:true,
			result:balance
		})

	} catch (error) {

		return res.status(500).send({
			message:"Internal Server Error",
			status:false
		  })

	}

})


// createWallets()



module.exports = router;
