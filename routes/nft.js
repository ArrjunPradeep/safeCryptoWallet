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
const auth = require("../middleware/auth");

// VALIDATION
const validate = (routeName) => {
  switch (routeName) {
    case "createToken":
      return [
        body("email").exists().isString().notEmpty().isEmail(),
        body("uri").exists().isString().notEmpty(),
        body("name").exists().isString().notEmpty(),
        body("description").exists().isString().notEmpty(),
        body("image").exists().isString().notEmpty(),
      ];
    case "createItem":
      return [
        body("email").exists().isString().notEmpty().isEmail(),
        body("auctionPrice").exists().isString().notEmpty(),
        body("tokenId").exists().isString().notEmpty(),
      ];
    case "marketSale":
      return [
        body("email").exists().isString().notEmpty().isEmail(),
        body("auctionPrice").exists().isString().notEmpty(),
        body("tokenId").exists().isString().notEmpty(),
      ];
    case "uploadFile":
      return [
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
        query("url").exists().isString().notEmpty().isURL(),
      ];
    case "marketItems":
      return [
        query("email").exists().notEmpty().isEmail(),
      ];
    case "ownedItems":
      return [
        query("email").exists().notEmpty().isEmail(),
      ];
    case "createdItems":
      return [
        query("email").exists().notEmpty().isEmail(),
      ];

    case "fetchTokens":
      return [
        query("email").exists().notEmpty().isEmail(),
      ];
  }
};

// MIDDLEWARES == ----FILE_UPLOAD----API_KEY_AUTH----
router.use(fileUpload());
router.use(auth.apiKeyAuth);

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
      message: {
        data: data
      },
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
router.get("/metaData", async (req, res, next) => {
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

    await nft.metadata("https://gateway.ipfs.io/ipfs/bafkreidrxucodcczws27gdhbx7nhn55ipc24d4gtjip635jflcqukfesnu");

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

// MIDDLEWARES == ----JWT_AUTH----API_KEY_AUTH----
router.use(auth.auth);

// CREATE NFT
router.post("/createToken", validate("createToken"), async (req, res) => {
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

    let { email, uri, name, description, image } = req.body;

    let data = await nft.createToken(email, uri, name, description, image);

    console.log("DATA", data)

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

// CREATE MARKET ITEM 
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

    let { email, auctionPrice, tokenId } = req.body;

    let data = await nft.createMarketItem(email, tokenId, auctionPrice);

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

// TOKENS [UNLISTED TOKENS]
router.get("/fetchTokens", validate("fetchTokens"), async (req, res) => {
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

    let tokens = await cache.get(`tokens-${email}`);

    if (tokens) {

      return res.status(200).send({
        status: true,
        message: {
          data: tokens
        }

      });

    } else {

      tokens = await nft.tokens(email);

      await cache.set(`tokens-${email}`, tokens.data.data);

      return res.status(tokens.statusCode).send({
        status: tokens.status,
        message: tokens.data
      });

    }

  } catch (error) {

    console.log(":: TOKENS :: ERROR ::", error);

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
        message: {
          data: marketItems
        }
      });

    } else {

      marketItems = await nft.marketItems(email);

      await cache.set(`fetchMarketItems-${email}`, marketItems.data.data);

      return res.status(marketItems.statusCode).send({
        status: marketItems.status,
        message: marketItems.data
      });

    }

  } catch (error) {
    console.log(":: MARKET_ITEMS :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }

})

// FETCH OWNED ITEMS
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

    let ownedItemss = await cache.get(`fetchMyNFTs-${email}`);

    if (ownedItemss) {

      return res.status(200).send({
        status: true,
        message: {
          data: ownedItemss
        }
      });

    } else {

      ownedItems = await nft.ownedItems(email);

      await cache.set(`fetchMyNFTs-${email}`, ownedItems.data.data);

      return res.status(ownedItems.statusCode).send({
        status: ownedItems.status,
        message: ownedItems.data
      });

    }

  } catch (error) {
    console.log(":: OWNED_ITEMS :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }

})

// FETCH CREATED ITEMS
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
        message: {
          data: createdItems
        }
      });

    } else {

      createdItems = await nft.createdItems(email);

      await cache.set(`fetchItemsCreated-${email}`, createdItems.data.data);

      return res.status(createdItems.statusCode).send({
        status: createdItems.status,
        message: createdItems.data
      });

    }

  } catch (error) {
    console.log(":: CREATED_ITEMS :: ERROR ::", error);

    return res.status(500).send({
      status: false,
      message: "Internal Server Error",
    });
  }

})

// FETCH MARKET ITEMS [LISTED TOKENS] [FROM MAINNET]
router.get("/marketItemss", validate("marketItems"), async (req, res) => {
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

// FETCH MY NFTs [FROM MAINNET]
router.get("/ownedItemss", validate("ownedItems"), async (req, res) => {
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

// FETCH ITEMS CREATED BY THEMSELVES [FROM MAINNET]
router.get("/createdItemss", validate("createdItems"), async (req, res) => {
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

module.exports = router;
