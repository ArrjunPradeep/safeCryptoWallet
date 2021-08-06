var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate-v2')

const schema = new mongoose.Schema({
    email: String,
    ref: Number,
    from: String,
    to: String,
    source: String,
    target: String,
    sourceAmount: String,
    targetAmount:String,
    type: String,
    value: String,
    currency: String,
    hash: String,
    status: String,
    error: String,
    reason: String,
    fee: Number
},{ collection: 'transactions'})

schema.plugin(mongoosePaginate);

module.exports = mongoose.model('transactions', schema)