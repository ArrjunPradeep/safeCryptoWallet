var express = require("express");
var router = express.Router();
const axios = require("axios");
const fileUpload = require("express-fileupload");
const nft = require("../nft/nft");
const body = require("express-validator").body;
const header = require("express-validator").header;
const query = require("express-validator").query;
const validationResult = require("express-validator").validationResult;
const cache = require('../lib/server/cache');
const config = require("../config/config");

// VALIDATION
const validate = (routeName) => {
  switch (routeName) {
    case "createItem":
      return [
        header("x-api-key").exists().equals(config.wallet.apiKey),
        body("auctionPrice").exists().isString().notEmpty(),
        body("uri").exists().isString().notEmpty(),
      ];
    case "marketSale":
      return [
        header("x-api-key").exists().equals(config.wallet.apiKey),
        body("auctionPrice").exists().isString().notEmpty(),
        body("tokenId").exists().isString().notEmpty(),
      ];
    case "uploadFile":
      return [
        header("x-api-key").exists().equals(config.wallet.apiKey),
        body("file")
          .custom((value, { req }) => {
            if (!req.files) throw new Error("File is Required");
            return true;
          }),
        body("name").exists().isString().notEmpty(),
        body("description").exists().isString().notEmpty(),
      ];
    case "metaData":
      return [
        header("x-api-key").exists().equals(config.wallet.apiKey),
        query("url").exists().isString().notEmpty().isURL(),
      ];
    case "marketItems":
      return [
        header("x-api-key").exists().equals(config.wallet.apiKey),
        query("email").exists().notEmpty(),
      ];
    case "ownedItems":
      return [
        header("x-api-key").exists().equals(config.wallet.apiKey),
        query("email").exists().notEmpty(),
      ];
    case "createdItems":
      return [
        header("x-api-key").exists().equals(config.wallet.apiKey),
        query("email").exists().notEmpty(),
      ];
  }
};

// MIDDLEWARES
router.use(fileUpload());

// CREATE NFT
router.post("/createItem", validate("createItem"), async (req, res) => {
  try {
    let errors = validationResult(req);
    if (errors.isEmpty() == false) {
      return res.status(412).send({
        status: false,
        message: "Validation Failed",
        error: errors,
      });
      return;
    }

    let { email, auctionPrice, uri } = req.body;

    let data = await nft.createMarketItem(email, uri, auctionPrice);

    console.log("DATA", data)

    if (data.error) {
      return res.status(400).send({
        status: false,
        message: data.error,
      });
    }

    return res.status(data.statusCode).send({
      status: data.status,
      message: data.data,
    });
  } catch (error) {
    console.log(":: CREATE_TOKEN :: ERROR :: ", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

// MARKET ITEM SALE - BUY NFT
router.post("/marketSale", validate("marketSale"), async (req, res) => {
  try {
    let errors = validationResult(req);
    if (errors.isEmpty() == false) {
      return res.status(412).send({
        status: false,
        message: "Validation Failed",
        error: errors,
      });
      return;
    }

    let { email, auctionPrice, tokenId } = req.body;

    let data = await nft.createMarketSale(email, tokenId, auctionPrice);

    if (data.error) {
      return res.status(400).send({
        status: false,
        message: data.error
      });
    }

    return res.status(data.statusCode).send({
      status: data.status,
      message: data.data
    });
  } catch (error) {
    console.log(":: CREATE_MARKET_SALE :: ERROR :: ", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

// FETCH MARKET ITEMS
router.get("/marketItems", validate("marketItems"), async (req, res) => {
  try {

    let errors = validationResult(req);
    if (errors.isEmpty() == false) {
      return res.status(412).send({
        status: false,
        message: "Validation Failed",
        error: errors,
      });
      return;
    }
    
    let { email } = req.query;

    let marketItems = await cache.get(`fetchMarketItems-${email}`);

    if (marketItems) {

      return res.status(200).send({
        status: true,
        message: marketItems
      });

    } else {

      marketItems = await nft.fetchMarketItems(email);

      if (marketItems.error) {
        return res.status(400).send({
          status: false,
          message: marketItems.error,
        });
      }

      await cache.set(`fetchMarketItems-${email}`, marketItems);
      return res.status(200).send({
        status: true,
        message: marketItems
      });
    }

  } catch (error) {
    console.log(":: MARKET_ITEMS :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

// FETCH MY NFTs
router.get("/ownedItems", validate("ownedItems"), async (req, res) => {
  try {

    let errors = validationResult(req);
    if (errors.isEmpty() == false) {
      return res.status(412).send({
        status: false,
        message: "Validation Failed",
        error: errors,
      });
      return;
    }

    let { email } = req.query;

    let ownedItems = await cache.get(`fetchMyNFTs-${email}`);

    if (ownedItems) {

      return res.status(200).send({
        status: true,
        message: ownedItems
      });

    } else {

      ownedItems = await nft.fetchMyNFTs(email);

      if (ownedItems.error) {
        return res.status(400).send({
          status: false,
          message: ownedItems.error,
        });
      }

      await cache.set(`fetchMyNFTs-${email}`, ownedItems);
      return res.status(200).send({
        status: true,
        message: ownedItems
      });
    }

  } catch (error) {
    console.log(":: OWNED_ITEMS :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

// FETCH ITEMS CREATED BY THEMSELVES
router.get("/createdItems", validate("createdItems"), async (req, res) => {
  try {

    let errors = validationResult(req);
    if (errors.isEmpty() == false) {
      return res.status(412).send({
        status: false,
        message: "Validation Failed",
        error: errors,
      });
      return;
    }

    let { email } = req.query;

    let createdItems = await cache.get(`fetchItemsCreated-${email}`);

    if (createdItems) {

      return res.status(200).send({
        status: true,
        message: createdItems
      });

    } else {

      createdItems = await nft.fetchItemsCreated(email);

      if (createdItems.error) {
        return res.status(400).send({
          status: false,
          message: createdItems.error,
        });
      }

      await cache.set(`fetchItemsCreated-${email}`, createdItems);
      return res.status(200).send({
        status: true,
        message: createdItems
      });
    }

  } catch (error) {
    console.log(":: CREATED_ITEMS :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

// UPLOAD IMAGE AND ITS METADATA
router.post("/uploadFile", validate("uploadFile"), async (req, res, next) => {
  try {
    let errors = validationResult(req);
    if (errors.isEmpty() == false) {
      return res.status(412).send({
        status: false,
        message: "Validation Failed",
        error: errors,
      });
      return;
    }

    let file = req.files.file;

    let { name, description } = req.body;

    let data = await nft.uploadFileToIPFS(file.data, name, description);

    return res.status(200).send({
      status: true,
      message: data,
    });
  } catch (error) {
    console.log(":: UPLOAD_FILE :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

// GET IPFS JSON METADATA
router.get("/metaData", validate("metaData"), async (req, res, next) => {
  try {
    let errors = validationResult(req);
    if (errors.isEmpty() == false) {
      return res.status(412).send({
        status: false,
        message: "Validation Failed",
        error: errors,
      });
      return;
    }

    let { url } = req.query;

    const config = {
      method: "GET",
      url: url
    };

    // const metaData = await cache.getOrSetCache(url, async() => {

    //   const { data } = await await axios(config);

    //   return data;

    // })

    // const response = await axios(config);
    //   return res.status(200).send({
    //     status: true,
    //     message: metaData
    //   });

    let metaData = await cache.get(url);
    if (metaData) {
      return res.status(200).send({
        status: true,
        message: metaData
      });
    } else {
      const response = await axios(config);
      await cache.set(url, response.data);
      return res.status(200).send({
        status: true,
        message: response.data
      });
    }


  } catch (error) {
    console.log(":: METADATA :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }
});

module.exports = router;
