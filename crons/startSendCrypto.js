const cron = require('node-cron');
const crypto_lib = require("../crons/sendTransaction");
const mongoose = require('mongoose')
const config = require("../config/config");

mongoose.connect('mongodb://' +
    config.db.userName +
    ':' +
    config.db.password +
    '@' +
    config.db.host +
    ':' +
    config.db.port +
    '/' +
    config.db.dbName,
    {
        useNewUrlParser: true,
        useCreateIndex: true,
        useUnifiedTopology: true
    }
).then(() => {

    console.log(":::::::  MONGODB CONNECTED :::::::");

    cron.schedule('* * * * *', () => {
        crypto_lib.initiateTransaction();
    });
    
}).catch((error) => {

    console.log("::::::: MONGODB NOT CONNECTED :::::::");

})