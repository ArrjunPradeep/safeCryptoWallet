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

    receiveCron: { 
        initialBlock: '0' //0
    }, 
    
    etherscan : {
        apiKey: 'IP3C2JRFFU14ER43G1N5BJXC6HI8BWPT9F'
    },

    bscscan : {
        apiKey: 'ZH8ZNRHSX9TCAAJDAVGXJRCRZBYFU5X1R4'
    },
                         
    wallet: {
        mnemonics: "observe room column stick carpet agree flavor safe decline trigger dial business",
        password: "318798111",
        network: "testnet",//"livenet", //"testnet",
        gasLimit: "0x7a1200",
        provider: "https://ropsten.infura.io/v3/4df9f11fa35549cd800bda9665b6ac94",
        bprovider: "https://data-seed-prebsc-2-s3.binance.org:8545/",
        web3Key: "16ff5fee085c49058c03811f9bceef0b",
        ref: "22222",
        contracts: [
            {
                name: 'Bank of BIT ETH',
                symbol: 'bobe',
                address: '0x75A471613aC0B0Ed0fCe30FdD45a649eE4542be5'
            },
        ]
    },
}
