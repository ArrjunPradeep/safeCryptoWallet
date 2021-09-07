var ethers = require("ethers");
var wallet_library = require('../lib/blockchain/wallet');
var contract_abi = require('../contract/abi').abi;
let provider;
const config = require("../config/config");
const transactionsModel = require("../models/transactions");
const walletsModel = require("../models/wallets");
const accountsModel = require("../models/accounts");
const tokensModel = require("../models/tokens");
const constants = require("../constants/constants");

const initializeWeb3 = async() => {
    try {
       
        var url = config.wallet.provider;
        provider = new ethers.providers.JsonRpcProvider(url);
        // console.log("PROVIDER::",provider);

    } catch (error) {
        console.log("INFURA ERROR :: ",error);
        throw new Error(error.message);
    }
}

const getWallet = async(ref) => {

    let privateKey = await (await wallet_library.generateAddress(ref,true)).privateKey;
    // console.log("PRIVATE KEY :: ", privateKey);
    return privateKey;

}

const initiateTransaction = async() => {

    try {
        
        let transactions = await transactionsModel.find({status: constants.TXNS.IN_QUEUE}).lean().exec();
        console.log("::TXNS::",transactions.length);

        if(transactions.length > 0) {
            
            transactions.forEach(async txn => {
                


                switch (txn.source) {
    
                    case "bnb": console.log("::COIN::");
                                sendCoin(txn);
                                break;  
    
                    default: console.log("::TOKEN::");
                             sendToken(txn);
                             break;
                }

            })

        }

    } catch (error) {
        
        console.log("INITIATE_TXN::ERROR::",error);
        return;

    }

}

const sendCoin = async(txn) => {

    try {
    
        await initializeWeb3();

        let account = await accountsModel.findOne({email:txn.email}).lean().exec();

        let wallet = new ethers.Wallet(await getWallet(account.ref),provider);
        console.log("WALLET ::",wallet.address);

        let walletSigner = wallet.connect(provider);
        console.log("SIGNER ::",walletSigner.address);

        // let gasLimit = await provider.estimateGas({
        //     to: txn.to,
        //     value: ethers.utils.parseEther(txn.sourceAmount)
        //   });
        
        // console.log("GAS LIMIT :: ",gasLimit);

        console.log("21312312",ethers.BigNumber.from(txn.gasLimit));

        const tx = 
        {
            from : wallet.address,
            to : txn.to,
            value : ethers.utils.parseEther(txn.sourceAmount),
            nonce : provider.getTransactionCount(wallet.address, 'latest'),
            // gasLimit : ethers.BigNumber.from(txn.gasLimit), // ethers.utils.parseEther(txn.gasLimit), //provider.estimateGas(), //ethers.utils.hexlify('100000'), // 100000
            // gasPrice : ethers.BigNumber.from(txn.gasPrice) //provider.getGasPrice()
        }        



        await walletSigner.sendTransaction(tx).then( async (transaction) => {
            console.log("TRANSACTION HASH :: ",transaction.hash);

            let status = "pending";
        
            await updateTxnStatus(txn._id, txn.from, status , transaction.hash, '');
        
        });
        
    } catch (error) {

        console.log("SEND COIN :: ", error.reason);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status , txn.hash, error.reason);

        return;
    }

}

const sendToken = async(txn) => {

    try {
        
        await initializeWeb3();

        let account = await accountsModel.findOne({email:txn.email}).lean().exec();
    
        let tokens = await tokensModel.findOne({symbol:(txn.source).toUpperCase()}).lean().exec();
    
        let wallet = new ethers.Wallet(await getWallet(account.ref),provider);
        console.log("WALLET ::",wallet.address);
    
        let walletSigner = wallet.connect(provider);
        console.log("SIGNER ::",walletSigner.address);
    
        let contractAddress = tokens.address;
    
        const contract = new ethers.Contract(contractAddress, contract_abi, walletSigner);
    
        // const contract_balance = (await contract.balanceOf(wallet.address)).toString();
    
        const contract_decimal = await contract.decimals();
        
        let token_amount = await ethers.utils.parseUnits(txn.sourceAmount, contract_decimal);
    
        console.log("TOKEN::",token_amount);
    
        await contract.transfer(txn.to, token_amount).then(async(transaction) => {
            
            console.log("TRANSACTION HASH :: ",transaction.hash);
    
            let status = "pending";
        
            await updateTxnStatus(txn._id, txn.from, status , transaction.hash, '');
        
        })

    } catch (error) {

        console.log("SEND TOKEN :: ", error.reason);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status , txn.hash, error.reason);

        return;
    }

}

const updateTxnStatus = async(id, from, status, hash, message) => {

    try {
        
        await transactionsModel.updateOne({
            _id:id
        },
        {
            $set:{
                from: from,
                hash: hash,
                status: status,
                reason: message
            }
        },
        {
            upsert:true
        })

    } catch (error) {
        
        console.log("::UPDATE_TXN::ERROR::",error);
        return;

    }

}

module.exports = {
    initiateTransaction
}