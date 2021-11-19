const express = require('express');
const jwt = require('jsonwebtoken');
const cache = require('../server/cache');
const config = require('../../config/config');
const router = express.Router();

// GENERATE JWT TOKEN
const generateToken = async(data) => {
    return jwt.sign( {data:data}, config.token.secret, {expiresIn:'24h'})
}

// VERIFY JWT TOKEN
const verifyToken = async(token) => {
    
    return jwt.verify( token, config.token.secret, async(error, result) => {

        if(error){

            return {
                status: false,
                message: ""
            }

        } 
        else{

            return {
                status: true,
                message: result
            }

        }

    })

}

module.exports = {
    generateToken,
    verifyToken
}