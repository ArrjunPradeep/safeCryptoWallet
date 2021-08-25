var mongoose = require('mongoose')

const schema = new mongoose.Schema({
    contractAddress: {
        bobe: String
    },
    wallet: {
        provider:String,
        intialBlock:String,
    },
    secret: String,
})

module.exports = mongoose.model('settings', schema)