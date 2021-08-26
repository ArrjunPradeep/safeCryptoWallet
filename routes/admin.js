var express = require('express');
var router = express.Router();
const ethereum_lib = require("../lib/crypto/ethereum");
const tokensModel = require("../models/tokens");

// ADD TOKEN DETAILS
router.post('/addToken', async(req, res, next) => {
  
  try {
    
    let { name, symbol, address, blockchain } = req.body;

    if(await ethereum_lib.isAddressValid(address) == false) {

      return res.status(401).send({
        status:false,
        message:"Invalid Address"
      })

    }

    address = await ethereum_lib.toCheckSumAddress(address);

    let isAddress = await tokensModel.findOne({address:address}).lean().exec();

    if(isAddress == null) {

      await tokensModel.create({
        name: name,
        symbol: symbol,
        address: address,
        blockchain: blockchain
      })
  
      return res.status(200).send({
        status: true,
        message:"Token Added"
      })

    }
    else {

      return res.status(401).send({
        status:false,
        message:"Token Already Present"
      })

    }


  } catch (error) {
    
    console.log("::ADD TOKEN::ERROR::",error);

    return res.status(500).send({
      status: false,
      message:"Internal Server Error"
    })

  }

});

module.exports = router;
