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
        // gasLimit: "0x7a1200",
        provider: "https://data-seed-prebsc-2-s3.binance.org:8545/",
        websocket: "wss://bsc.getblock.io/testnet/?api_key=7f919aac-9d46-49f6-8dc9-453d3a9471a6",
        initialBlock: '0'
    }
}
