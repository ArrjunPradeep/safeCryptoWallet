var ethers = require("ethers");
var wallet_library = require('../lib/blockchain/wallet');
var contract_abi = require('../contract/abi').abi;
let provider;
const config = require("../config/config");
const transactionsModel = require("../models/transactions");
const walletsModel = require("../models/wallets");
const accountsModel = require("../models/accounts");
const settingsModel = require("../models/settings");
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

    let privateKey = await (await wallet_library.generateEthereumAddress(ref,true)).privateKey;
    console.log("PRIVATE KEY :: ", privateKey);
    return privateKey;

}

const initiateTransaction = async() => {

    try {
        
        let transactions = await transactionsModel.find({status: constants.TXNS.IN_QUEUE}).lean().exec();
        console.log("::TXNS::",transactions.length);

        if(transactions.length > 0) {
            
            transactions.forEach(async txn => {
                


                switch (txn.source) {
    
                    case "eth": console.log("::ETH::");
                                sendETH(txn);
                                break;  
    
                    default: console.log("::ERC20::");
                             sendERC20(txn);
                             break;
                }

            })

        }

    } catch (error) {
        
        console.log("INITIATE_TXN::ERROR::",error);
        return;

    }

}

const sendETH = async(txn) => {

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

        const tx = 
        {
            from : wallet.address,
            to : txn.to,
            value : ethers.utils.parseEther(txn.sourceAmount),
            nonce : provider.getTransactionCount(wallet.address, 'latest'),
            gasLimit : txn.gasLimit, //provider.estimateGas(), //ethers.utils.hexlify('100000'), // 100000
            gasPrice : txn.gasPrice //provider.getGasPrice()
        }        



        await walletSigner.sendTransaction(tx).then( async (transaction) => {
            console.log("TRANSACTION HASH :: ",transaction.hash);

            let status = "pending";
        
            await updateTxnStatus(txn._id, txn.from, status , transaction.hash, '');
        
        });
        
    } catch (error) {

        console.log("SEND ETH :: ", error.reason);

        let status = "failed";

        await updateTxnStatus(txn._id, txn.from, status , txn.hash, error.reason);

        return;
    }

}

const sendERC20 = async(txn) => {

    try {
        
        await initializeWeb3();

        let account = await accountsModel.findOne({email:txn.email}).lean().exec();
    
        let settings = await settingsModel.findOne({}).lean().exec();
    
        let wallet = new ethers.Wallet(await getWallet(account.ref),provider);
        console.log("WALLET ::",wallet.address);
    
        let walletSigner = wallet.connect(provider);
        console.log("SIGNER ::",walletSigner.address);
    
        let contractAddress = settings.contract[`${(txn.source).toUpperCase()}`];
    
        const contract = new ethers.Contract(contractAddress, contract_abi, walletSigner);
    
        // const contract_balance = (await erc20.balanceOf(wallet.address)).toString();
    
        const contract_decimal = await contract.decimals();
        
        let token_amount = await ethers.utils.parseUnits('2', contract_decimal);
    
        console.log("ERC20::",token_amount.toString());
    
        await contract.transfer(txn.to, token_amount).then(async(transaction) => {
            
            console.log("TRANSACTION HASH :: ",transaction.hash);
    
            let status = "pending";
        
            await updateTxnStatus(txn._id, txn.from, status , transaction.hash, '');
        
        })

    } catch (error) {

        console.log("SEND ERC20 :: ", error.reason);

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
                txHash: hash,
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

// sendERC20()
// sendEth()

module.exports = {
    initiateTransaction
}

//  catch (error) {
//     console.log("ERROR:", error)
//     res.status(500).send({
//       status: "Fail",
//       error: JSON.parse(CircularJSON.stringify(error.response.data.message))
//     })
//   }