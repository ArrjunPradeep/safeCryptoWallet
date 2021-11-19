const { realpathSync } = require('fs');
const jwt_lib = require('../lib/server/jwt');
const config = require("../config/config");

// AUTHORIZATION & X-API-KEY
const auth = async (req, res, next) => {

    let headers = !req.header('Authorization') ? "Token Is Missing" : req.header('x-api-key') ? true : "API Key Is Missing"

    if (headers != true) {
        return res.status(412).send({
            status: false,
            message: headers
        })
    }

    const token = req.header('Authorization').split(' ')[1];

    const apiKey = req.header('x-api-key');

    try {

        const decode = await jwt_lib.verifyToken(token);

        if (decode.status) {

            if (apiKey != config.wallet.apiKey) {

                return res.status(412).send({
                    status: false,
                    message: "Invalid API Key"
                })

            }

            // Can set req.user  (email=>decode.data.email), ie DB info OR email & _id, userName 

        } else {

            return res.status(412).send({
                status: false,
                message: "Invalid Token"
            })

        }

    } catch (error) {

        return res.status(412).send({
            status: false,
            message: "Invalid Token"
        })

    }

    return next();

}

// X-API-KEY
const apiKeyAuth = async (req, res, next) => {

    let headers = req.header('x-api-key') ? true : "API Key Is Missing"

    if (headers != true) {
        return res.status(412).send({
            status: false,
            message: headers
        })
    }

    const apiKey = req.header('x-api-key');

    try {

        if (apiKey != config.wallet.apiKey) {

            return res.status(412).send({
                status: false,
                message: "Invalid API Key"
            })

        }

        // Can set req.user  (email=>decode.data.email), ie DB info OR email & _id, userName 

    } catch (error) {

        return res.status(412).send({
            status: false,
            message: "Invalid API Key"
        })

    }

    return next();

}

module.exports = {
 auth,
 apiKeyAuth   
}