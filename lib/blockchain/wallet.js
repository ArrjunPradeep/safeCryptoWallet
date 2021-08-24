const ethers = require('ethers');
const bip39 = require("bip39");

// ETHEREUM PATH
const path = "m/44'/60'/0'";

// PASSPHRASE
const password = "crypoWallet11112222";

// MNEMONIC
const mnemonic = "display absurd hold cause anxiety sick reflect oxygen library veteran seven barrel" //bip39.generateMnemonic()

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