var mongoose = require('mongoose');

module.exports = mongoose.model('accounts', {
    email: {
        type: String,
        unique: true
    },
    password: String,
    id: String,
    ref: {
        type: Number,
        unique: true
    },
    auth2: {
        type: Boolean,
        default: false
    },
    accountStatus: {
        type: String,
        default: "active"
    }
})