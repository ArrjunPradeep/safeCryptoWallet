import cron from 'node-cron';
import send from '../wallet/sendTransaction';

// const mongoose = require('mongoose')
// const config = require('./config')

// mongoose.connect('mongodb://' + config.db.userName + ':' + config.db.password + '@' + config.db.host + ':' + config.db.port + '/' + config.db.dbName).then(() => {
    cron.schedule('* * * * *', () => {
        cryptoLib.sendTransaction()
    });
// })