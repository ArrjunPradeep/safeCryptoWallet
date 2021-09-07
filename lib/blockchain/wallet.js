const ethers = require('ethers');
const bip39 = require("bip39");
const config = require("../../config/config");

// ETHEREUM PATH
const path = "m/44'/60'/0'";

// PASSPHRASE
const password = config.wallet.passphrase;

// MNEMONIC
const mnemonic = config.wallet.mnemonic; //bip39.generateMnemonic()

let node = ethers.utils.HDNode.fromMnemonic(mnemonic,password);
let child = node.derivePath(path) //.neuter();
let xpub = child.extendedKey;

// LOAD THE XPUB AND DERIVE THE CHILD PATHS
child = ethers.utils.HDNode.fromExtendedKey(xpub);

// GENERATE ETHEREUM PRIV, PUB, ADDRESS
const generateAddress = async(account, internal ) => {

    let internalIndex = internal ? "/1" : "/0";

    // console.log("ETH :: ",child.derivePath(account.toString() + internalIndex))
    return child.derivePath(account.toString() + internalIndex);

}

module.exports = {
    generateAddress
}
// generateAddress(2,true)