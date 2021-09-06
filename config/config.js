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
        gasLimit: "50000", //50000
        provider: "https://data-seed-prebsc-2-s3.binance.org:8545/",
        websocket: "wss://bsc.getblock.io/testnet/?api_key=b6c78cbb-4bf5-4719-838f-11e3cf7604f8",//"wss://bsc.getblock.io/testnet/?api_key=7f919aac-9d46-49f6-8dc9-453d3a9471a6",
        initialBlock: '0',
        apiKey: "L4gTDYc4af=2n=Kj"
    }
}
