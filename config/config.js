require('dotenv').config();

module.exports = {
    
    db: {
        host: "localhost",
        port: "27017",
        userName: "bobe",
        password: "bobe369",
        dbName: "bobecoin"
    },

    token: {
        secret: "password"
    },
                         
    wallet: {
        mnemonic: process.env.MNEMONIC,
        passphrase: process.env.PASSPHRASE,
        gasLimit: "50000", //50000
        gasPrice: "0.00000001", //10gwei
        provider: process.env.PROVIDER,
        websocket: process.env.WEBSOCKET_URL,//"wss://bsc.getblock.io/testnet/?api_key=7f919aac-9d46-49f6-8dc9-453d3a9471a6",
        initialBlock: '0',
        apiKey: process.env.API_KEY
    }
}
