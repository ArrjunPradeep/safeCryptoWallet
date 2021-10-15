const { rejects } = require('assert');
const { resolve } = require('path');
const redis = require('redis');
const { promisify } = require('util');
const client = redis.createClient({
    host: '127.0.0.1',
    port: 6379
});

const DEFAULT_EXPIRATION = 5; // 5 seconds

const GET_ASYNC = promisify(client.get).bind(client);
const SET_ASYNC = promisify(client.set).bind(client)

const get = async (key) => {

    const reply = await GET_ASYNC(key);

    if (reply) {
        console.log("Using cached data");
        return JSON.parse(reply);
    }

    return null;
}

const set = async (key, value) => {

    const response = await SET_ASYNC(key, JSON.stringify(value), 'EX', DEFAULT_EXPIRATION);

    console.log("new Data Cached");

    return response;
}

const getOrSetCache = async (key, callback) => {

    return new Promise((resolve, reject) => {
        client.get(key, async (error, data) => {
            if (error) return reject(error);
            if (data != null) {
                console.log("Cached Data")
                return resolve(JSON.parse(data));
            }
            const freshData = await callback();

            client.setex(key, DEFAULT_EXPIRATION, JSON.stringify(freshData));
            console.log("New Cached Data")

            resolve(freshData);
        })
    })

}

module.exports = {
    getOrSetCache,
    get,
    set
}