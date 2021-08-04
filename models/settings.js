var mongoose = require('mongoose')

const schema = new mongoose.Schema({
    infuraKey: String,
    infuraNetwork: Boolean,
    adminRef: Number,
    contractAddress: {
        usdt: String
    }
})

module.exports = mongoose.model('settings', schema)