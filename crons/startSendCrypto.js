const cron = require('node-cron');
const crypto_lib = require("../crons/sendTransaction");
const mongoose = require('mongoose')
const config = require("../config/config");

mongoose.connect('mongodb://' + config.db.userName + ':' + config.db.password + '@' + config.db.host + ':' + config.db.port + '/' + config.db.dbName).then(() => {
    cron.schedule('* * * * *', () => {
        crypto_lib.initiateTransaction();
    });
})