var ethers = require("ethers");
var wallet_library = require('../lib/blockchain/wallet');
var contract_abi = require('../contract/abi').abi;
let provider;

const initializeWeb3 = async() => {
    try {
       
        var url = 'https://ropsten.infura.io/v3/a478bf40f7b24494b30b082c0d225104';
        provider = new ethers.providers.JsonRpcProvider(url);
        // console.log("PROVIDER::",provider);

    } catch (error) {
        console.log("INFURA ERROR :: ",error);
        throw new Error(error.message);
    }
}

// initializeWeb3()

const getWallet = async(ref) => {

    let privateKey = await (await wallet_library.generateEthereumAddress(ref,true)).privateKey;
    console.log("PRIVATE KEY :: ", privateKey);
    return privateKey;

}
// getWallet(2)
const sendEth = async() => {

    try {
    
        await initializeWeb3();

        let wallet = new ethers.Wallet(await getWallet(1),provider);
        console.log("WALLET ::",wallet.address);

        let walletSigner = wallet.connect(provider);
        console.log("SIGNER ::",walletSigner.address);

        let gasLimit = await provider.estimateGas({
            to: "0x1a7e8147208a69cf0753816AEe4BDA54b6BC41B8",
            value: ethers.utils.parseEther("0.01")
          });
        
        console.log("GAS LIMIT :: ",gasLimit);

        const tx = 
        {
            from : wallet.address,
            to : '0x1a7e8147208a69cf0753816AEe4BDA54b6BC41B8',
            value : ethers.utils.parseEther('0.01'),
            nonce : provider.getTransactionCount(wallet.address, 'latest'),
            gasLimit : gasLimit, //provider.estimateGas(), //ethers.utils.hexlify('100000'), // 100000
            gasPrice : provider.getGasPrice()
        }        



        walletSigner.sendTransaction(tx).then((transaction) => {
            console.log("TRANSACTION HASH :: ",transaction.hash);
        });
        
    } catch (error) {
        console.log("SEND ETH :: ", error);
        return;
    }

}

const sendERC20 = async() => {

    await initializeWeb3();

    let wallet = new ethers.Wallet(await getWallet(1),provider);
    console.log("WALLET ::",wallet.address);

    let walletSigner = wallet.connect(provider);
    console.log("SIGNER ::",walletSigner.address);

    let contractAddress = '0x75A471613aC0B0Ed0fCe30FdD45a649eE4542be5';

    const erc20 = new ethers.Contract(contractAddress, contract_abi, walletSigner);

    const erc20_balance = (await erc20.balanceOf(wallet.address)).toString();

    const erc20_decimal = await erc20.decimals();
    
    const token_amount = await ethers.utils.parseUnits('1', 2);

    console.log("ERC20::",token_amount.toString());

    const erc20_transfer = await erc20.transfer('0x1a7e8147208a69cf0753816AEe4BDA54b6BC41B8', 100);

    console.log("TRANSFER :: ", erc20_transfer)

}

sendERC20()
// sendEth()