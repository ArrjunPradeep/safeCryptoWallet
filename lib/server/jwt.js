const express = require('express');
const jwt = require('jsonwebtoken');
const cache = require('../server/cache');
const config = require('../../config/config');
const { compareSync } = require('bcrypt');
const router = express.Router();

// GENERATE JWT TOKEN
const generateToken = async(data) => {
    return jwt.sign( {data:data}, config.token.secret, {expiresIn:'24h'})
}

// VERIFY JWT TOKEN
const verifyToken = async(token) => {
    
    return jwt.verify( token, config.token.secret, { expiresIn:'5d' }, async(error, result) => {

        if(error){

            console.log("wetwerwe")

            return {
                status: "invalid",
                message: ""
            }

        } 
        else{

            console.log("254254253")

            return {
                status: "valid",
                message: result
            }

        }

    })

}

// TOKEN AUTHENTICATION MIDDLEWARE
router.use(async (req, res, next) => {

    if (req.headers['authorization']) {

        let token = req.headers.authorization

        if (token.slice(0, 6) == ("Bearer" || "bearer")) {
            token = token.slice(7)
        }

        console.log("agfsd",token)

        let status = verifyToken(token);
        console.log('TOKEN STATUS :: ', status)

        if (status.status == "valid") {

            try {
                console.log('TOKEN STATUS :: ', status)
                
                req.user = cache.getAlive(cache.collectionName.session, tokenStatus.message.email)
                
                console.log("REQ USER :: ",req.user);

                delete req.user['pin']
                delete req.user['password']

                if (req.user.sessionId != token) {

                    res.status(401).send({
                        status: false,
                        message: 'Invalid Token Logout',
                        error: 'Nil'
                    })

                } else {
                    
                    next()
                
                }

                return 

            } catch (error) {

                console.log(error)

                res.status(401).send({
                    status: false,
                    message: 'Token Not Found',
                    error: 'Nil'
                })

                return
            }
        } else {

            console.log(":: INVALID TOKEN ::");

            res.status(401).send({
                status: false,
                message: 'Invalid Token',
                error: 'Nil'
            })
        }

    } else {

        console.log(":: TOKEN EXPIRED ::");

        res.status(401).send({
            status: false,
            message: 'Token Expired',
            error: 'Nil'
        })
    }


})

module.exports = {
    generateToken,
    verifyToken,
    router
}