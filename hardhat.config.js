require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config();

// npx hardhat verify --network ropsten 0x5FbDB2315678afecb367f032d93F642f64180aa3 "Success" "SCS" 18
// npx hardhat verify --constructor-args scripts/token.js 0xE79dA49b082D21cfD313104D071cb3856C928d71 --network ropsten

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.4",
  networks:{
    mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      // gasPrice: 1000000000,
      accounts:[`0x${PRIVATE_KEY}`]
    },
    testnet: {
      url: process.env.PROVIDER, //"https://data-seed-prebsc-2-s3.binance.org:8545/",
      chainId: 97,
      accounts:[`0x${PRIVATE_KEY}`]
    },
  },
  etherscan: {
    apiKey: process.env.BNB_API_KEY
  }
};