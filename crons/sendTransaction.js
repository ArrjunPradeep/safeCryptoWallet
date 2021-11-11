var ethers = require("ethers");
var wallet_library = require('../lib/blockchain/wallet');
var contract_abi = require('../contract/abi').abi;
var nft_token_contract_abi = require('../artifacts/contracts/NFT.sol/NFT.json').abi;
var nft_marketplace_contract_abi = require("../artifacts/contracts/NFTMarket.sol/NFTMarket.json").abi;
let provider;
const ethereum_lib = require("../lib/crypto/ethereum");
const config = require("../config/config");
const transactionsModel = require("../models/transactions");
const nftsModel = require("../models/nft");
const walletsModel = require("../models/wallets");
const accountsModel = require("../models/accounts");
const tokensModel = require("../models/tokens");
const settingsModel = require("../models/settings");
const constants = require("../constants/constants");

const initializeWeb3 = async () => {
    try {

        var url = config.wallet.provider;
        provider = new ethers.providers.JsonRpcProvider(url);
        // console.log("PROVIDER::",provider);

    } catch (error) {
        console.log("INFURA ERROR :: ", error);
        throw new Error(error.message);
    }
}

const getWallet = async (ref) => {

    let privateKey = await (await wallet_library.generateAddress(ref, true)).privateKey;
    // console.log("PRIVATE KEY :: ", privateKey);
    return privateKey;

}

const initiateTransaction = async () => {

    try {

        let transactions = await transactionsModel.find({ status: constants.TXNS.IN_QUEUE }).lean().exec();
        console.log("::TXNS::", transactions.length);

        if (transactions.length > 0) {

            transactions.forEach(async txn => {

                switch (txn.source) {

                    case "bnb": console.log("::COIN::");

                        if (txn.method == "createToken") {
                            createToken(txn);
                        } else if (txn.method == "createMarketItem") {
                            createMarketItem(txn);
                        } else if (txn.method == "createMarketSale") {
                            createMarketSale(txn);
                        } else {
                            sendCoin(txn);
                        }

                        break;

                    default: console.log("::TOKEN::");
                        sendToken(txn);
                        break;
                }

            })

        }

    } catch (error) {

        console.log("INITIATE_TXN::ERROR::", error);
        return;

    }

}

const sendCoin = async (txn) => {

    try {

        await initializeWeb3();

        let account = await accountsModel.findOne({ email: txn.email }).lean().exec();

        let wallet = new ethers.Wallet(await getWallet(account.ref), provider);
        console.log("WALLET ::", wallet.address);

        let walletSigner = wallet.connect(provider);
        console.log("SIGNER ::", walletSigner.address);

        // let gasLimit = await provider.estimateGas({
        //     to: txn.to,
        //     value: ethers.utils.parseEther(txn.sourceAmount)
        //   });

        // console.log("GAS LIMIT :: ",gasLimit);

        console.log("21312312", ethers.BigNumber.from(txn.gasLimit));

        const tx =
        {
            from: wallet.address,
            to: txn.to,
            value: ethers.utils.parseEther(txn.sourceAmount),
            nonce: provider.getTransactionCount(wallet.address, 'latest'),
            // gasLimit : ethers.BigNumber.from(txn.gasLimit), // ethers.utils.parseEther(txn.gasLimit), //provider.estimateGas(), //ethers.utils.hexlify('100000'), // 100000
            // gasPrice : ethers.BigNumber.from(txn.gasPrice) //provider.getGasPrice()
        }



        await walletSigner.sendTransaction(tx).then(async (transaction) => {
            console.log("TRANSACTION HASH :: ", transaction.hash);

            let status = "pending";

            await updateTxnStatus(txn._id, txn.from, status, transaction.hash, '', '');

        });

    } catch (error) {

        console.log("SEND COIN :: ", error.reason);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status, txn.hash, error.reason, '');

        return;
    }

}

const sendToken = async (txn) => {

    try {

        await initializeWeb3();

        let account = await accountsModel.findOne({ email: txn.email }).lean().exec();

        let tokens = await tokensModel.findOne({ symbol: (txn.source).toUpperCase() }).lean().exec();

        let wallet = new ethers.Wallet(await getWallet(account.ref), provider);
        console.log("WALLET ::", wallet.address);

        let walletSigner = wallet.connect(provider);
        console.log("SIGNER ::", walletSigner.address);

        let contractAddress = tokens.address;

        const contract = new ethers.Contract(contractAddress, contract_abi, walletSigner);

        // const contract_balance = (await contract.balanceOf(wallet.address)).toString();

        const contract_decimal = await contract.decimals();

        let token_amount = await ethers.utils.parseUnits(txn.sourceAmount, contract_decimal);

        console.log("TOKEN::", token_amount);

        await contract.transfer(txn.to, token_amount).then(async (transaction) => {

            console.log("TRANSACTION HASH :: ", transaction.hash);

            let status = "pending";

            await updateTxnStatus(txn._id, txn.from, status, transaction.hash, '', '');

        })

    } catch (error) {

        console.log("SEND TOKEN :: ", error.reason);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status, txn.hash, error.reason, '');

        return;
    }

}

// NFT - CreateToken
const createToken = async (txn) => {

    try {

        await initializeWeb3();

        let account = await accountsModel.findOne({ email: txn.email }).lean().exec();

        let contractAddress = (await settingsModel.findOne({}).lean().exec()).nft_address;

        let wallet = new ethers.Wallet(await getWallet(account.ref), provider);
        // console.log("WALLET ::", wallet.address);

        let walletSigner = wallet.connect(provider);
        // console.log("SIGNER ::", walletSigner.address);

        const contract = new ethers.Contract(contractAddress, nft_token_contract_abi, walletSigner);

        await contract.createToken(txn.uri, { gasLimit: Number(txn.gasLimit) }).then(async (transaction) => {

            console.log("TRANSACTION HASH :: ", transaction);

            let status = constants.TXNS.PENDING;

            let method = await ethereum_lib.functionDataDecoding(nft_token_contract_abi, transaction.data);

            await updateTxnStatus(txn._id, txn.from, status, transaction.hash, '', method);

        }).catch(async (error) => {

            let status = "failed";

            let method = await ethereum_lib.functionDataDecoding(nft_token_contract_abi, error.transaction.data);

            await updateTxnStatus(txn._id, txn.from, status, error.transaction.hash, error.reason, method);

            return;
        })

    } catch (error) {

        console.log("CREATE_TOKEN :: ", error);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status, txn.hash, error, '');

        return;
    }

}

// NFT - CreateMarketItem
const createMarketItem = async (txn) => {

    try {

        await initializeWeb3();

        let account = await accountsModel.findOne({ email: txn.email }).lean().exec();

        let contractAddress = (await settingsModel.findOne({}).lean().exec()).marketplace_address;

        let tokenContractAddress = (await settingsModel.findOne({}).lean().exec()).nft_address;

        let wallet = new ethers.Wallet(await getWallet(account.ref), provider);

        let walletSigner = wallet.connect(provider);

        const contract = new ethers.Contract(contractAddress, nft_marketplace_contract_abi, walletSigner);

        let listingPrice = await contract.getListingPrice();

        let auctionPrice = ethers.utils.parseUnits(txn.auctionPrice, "ether");

        await contract.createMarketItem(
            tokenContractAddress,
            txn.tokenId,
            auctionPrice,
            {
                value: listingPrice,
                gasLimit: Number(txn.gasLimit)

            }).then(async (transaction) => {

                console.log("TRANSACTION HASH :: ", transaction);

                await nftsModel.updateOne(
                    {
                        tokenId: txn.tokenId
                    },
                    {
                        $set: {
                            market: true
                        }
                    }
                )

                let status = constants.TXNS.PENDING;

                let method = await ethereum_lib.functionDataDecoding(nft_marketplace_contract_abi, transaction.data);

                await updateTxnStatus(txn._id, txn.from, status, transaction.hash, '', method);

            }).catch(async (error) => {

                console.log(" :: CREATE_MARKET_ITEM :: ", error);

                let status = "failed";

                let method = await ethereum_lib.functionDataDecoding(nft_marketplace_contract_abi, error.transaction.data);

                await updateTxnStatus(txn._id, txn.from, status, error.transaction.hash, error.reason, method);

                return;
            })

    } catch (error) {

        console.log("CREATE_MARKET_ITEM :: ", error);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status, txn.hash, error, txn.method);

        return;
    }

}

// NFT - CreateMarketSale
const createMarketSale = async (txn) => {

    try {

        await initializeWeb3();

        let account = await accountsModel.findOne({ email: txn.email }).lean().exec();

        let contractAddress = (await settingsModel.findOne({}).lean().exec()).marketplace_address;

        contractAddress = ethers.utils.getAddress(contractAddress);

        let tokenContractAddress = (await settingsModel.findOne({}).lean().exec()).nft_address;

        tokenContractAddress = ethers.utils.getAddress(tokenContractAddress);

        let wallet = new ethers.Wallet(await getWallet(account.ref), provider);

        let walletSigner = wallet.connect(provider);

        const contract = new ethers.Contract(contractAddress, nft_marketplace_contract_abi, walletSigner);

        console.log("ITEM ID :: ", txn.itemId);

        let auctionPrice = await ethers.utils.parseUnits(txn.auctionPrice, "ether");

        await contract.createMarketSale(
            tokenContractAddress,
            txn.itemId,
            {
                value: auctionPrice,
                gasLimit: Number(txn.gasLimit)

            }).then(async (transaction) => {

                console.log("TRANSACTION HASH :: ", transaction);

                await nftsModel.updateOne(
                    {
                        tokenId: txn.tokenId
                    },
                    {
                        $set: {
                            market: true
                        }
                    }
                )

                let status = constants.TXNS.PENDING;

                let method = await ethereum_lib.functionDataDecoding(nft_marketplace_contract_abi, transaction.data);

                await updateTxnStatus(txn._id, txn.from, status, transaction.hash, '', method);

            }).catch(async (error) => {

                console.log(" :: CREATE_MARKET_ITEM :: ", error);

                let status = "failed";

                let method = await ethereum_lib.functionDataDecoding(nft_marketplace_contract_abi, error.transaction.data);

                await updateTxnStatus(txn._id, txn.from, status, error.transaction.hash, error.reason, method);

                return;
            })

    } catch (error) {

        console.log("CREATE_MARKET_ITEM :: ", error);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status, txn.hash, error, txn.method);

        return;
    }

}

const updateTxnStatus = async (id, from, status, hash, message, method) => {

    try {

        await transactionsModel.updateOne({
            _id: id
        },
            {
                $set: {
                    from: from,
                    hash: hash,
                    status: status,
                    reason: message,
                    method: method
                }
            },
            {
                upsert: true
            })

    } catch (error) {

        console.log("::UPDATE_TXN::ERROR::", error);
        return;

    }

}

module.exports = {
    initiateTransaction
}