const bcrypt = require('bcryptjs');
const saltRounds = 10;

const hash = async(password) => {
    
    let result = await bcrypt.hash(password, saltRounds);
    return result;

}

const verify = async(password, hash) => {

    let result = await bcrypt.compare(password, hash);
    return result;
    
}
 
module.exports = {
    hash,
    verify
}