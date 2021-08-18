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
                name: 'tether',
                symbol: 'usdt',
                address: '0x26Ec9247b593254F29Da25a0cae5b8743D1EB1fe',
                decimal: 6,
                network: 'testnet'
            },
            {
                name: 'PureCoin',
                symbol: 'pure',//pure
                address: '0x7Df3f1674FA9922b8B5308BAeDeb7a8F64e67C60',
                decimal: 2,
                network: 'testnet'
            }

        ],
        btc: {
            node: 'https://insight.bitpay.com/api',
            testnetNode: 'http://api.blockcypher.com/v1/btc/test3',
            network: 'testnet', //livenet
            adminAddress: '2MunGKbeWBahXTiHdKH6KZp65uzJXnApevB',
            privKey: ''
        },
        eth: {
            node: 'https://insight.bitpay.com/api',
            testnetNode: 'http://api.blockcypher.com/v1/btc/test3',
            network: 'testnet', //livenet
            // adminAddress: '0xb3e0D381194D4DB3fC6d0A421B6FD4986A921071',
            // privKey: '0x47136F90271DD080AFEDDC5564D1B5AF31546E2581095E276D4897EAAFEA1D87'
        },
        usdt: {
            node: 'https://insight.bitpay.com/api',
            testnetNode: 'http://api.blockcypher.com/v1/btc/test3',
            network: 'testnet', //livenet
            // adminAddress: '0xb3e0D381194D4DB3fC6d0A421B6FD4986A921071',
            // privKey: '0x47136F90271DD080AFEDDC5564D1B5AF31546E2581095E276D4897EAAFEA1D87'
        },
        pure: {
            node: 'https://insight.bitpay.com/api',
            testnetNode: 'http://api.blockcypher.com/v1/btc/test3',
            network: 'testnet', //livenet
            // adminAddress: '0xb3e0D381194D4DB3fC6d0A421B6FD4986A921071',
            // privKey: '0x47136F90271DD080AFEDDC5564D1B5AF31546E2581095E276D4897EAAFEA1D87'
        },
    },
}
