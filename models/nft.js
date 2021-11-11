var mongoose = require('mongoose')

const schema = new mongoose.Schema({
    email: String,
    tokenId: String,
    itemId: {
        type: String,
        default: '0'
    },
    tokenURI: String,
    metadata: {
        name: String,
        description: String,
        image: String 
    },
    seller: {
        type: String,
        default: "0x0000000000000000000000000000000000000000"
    },
    owner: {
        type: String,
        default: "0x0000000000000000000000000000000000000000"
    },
    sold: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: false
    },
    market: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: String,
        default: new Date().getTime()
    },
    price: String
})

module.exports = mongoose.model('nfts', schema)