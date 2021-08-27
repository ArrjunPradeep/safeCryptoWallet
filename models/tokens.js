var mongoose = require('mongoose')

const schema = new mongoose.Schema({
    name: String,
    symbol: String,
    address: String,
    decimal: String,
    blockchain: String,
    status: {
        type: Boolean,
        default: true
    }
})

module.exports = mongoose.model('tokens', schema)