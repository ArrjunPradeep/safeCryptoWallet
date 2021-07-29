var mongoose = require('mongoose');

module.exports = mongoose.model('accounts', {
    email: String,
    password: String,
    id: String,
    ref: Number,
    auth2: {
        type: Boolean,
        default: false
    },
    accountStatus: {
        type: String,
        default: "active"
    }
})