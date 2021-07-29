const bcrypt = require('bcrypt');
const saltRounds = 10;

const hash = async(password) => {
    bcrypt.hash(password, saltRounds).then(function(hash) {
        return hash;
    });
}

const verify = async(password, hash) => {
    bcrypt.compare(password, hash).then(function(result) {
        console.log(result)
        return result;
    });
}
 
module.exports = {
    hash,
    verify
}