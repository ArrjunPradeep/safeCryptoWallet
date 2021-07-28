let lokijs = require('lokijs')
let cache = new lokijs();
let path = require("path");
let mkdirp = require("mkdirp");
let fs = require("fs");
dirname = path.join(__dirname, "/db");

const collectionName = {
    session: "session",
    registration: "registration",
    marketData: "marketData",
    auth2Login: "auth2Login",
    otp_verify: "otp_verify",
    whitelist_verify: "whitelist_verify"
}

if (!fs.existsSync(dirname)) {
    mkdirp.sync(dirname);
}

cache = new lokijs(path.join(dirname, "cache.db"), {
    autosave: true,
    autosaveInterval: 30 * 1000,
    autoload: true,
    verbose: true
});

isInitialized = true;


const get = (collectionName, id) => {
    let collection = getCollection(collectionName);
    let data = collection.findOne({
        id
    });

    if (data) {
        remove(collectionName, id);
        delete data["$loki"];
    }

    return data;
}

function getCollection(name) {
    if (!isInitialized) {
        throw new Error("call_init_first");
    }

    let collection = cache.getCollection(name);
    if (!collection) {
        collection = cache.addCollection(name, {
            indices: ["id"]
        });
    }

    return collection;
}

const create = (collectionName, id, data, duration) => {
    if (!collectionName) {
        throw new Error("require_collection_name");
    }

    if (data === undefined || data === null) {
        throw new Error("require_data");
    }

    if (!id) {
        throw new Error("require_id");
    }

    if (!duration) {
        data.expired = Date.now() + 60 * 60 * 1000;
    } else {
        data.expired = Date.now() + duration;
    }

    data.id = id;
    let collection = getCollection(collectionName);
    remove(collectionName, data.id);
    collection.insertOne(data);
}

const remove = (collectionName, id) => {
    let collection = getCollection(collectionName);
    let data = collection.find({
        id
    });

    collection.remove(data);
}


const getAlive = (collectionName, id) => {
    let collection = getCollection(collectionName);
    let data = collection.findOne({
        id: id,
        expired: {
            '$gt': Date.now()
        }
    });
    return data;
}

const update = (collectionName, id, dataToUpdate) => {
    let collection = getCollection(collectionName)
    let data = collection.chain().find({
        "id": id
    }).update(cacheData => {
        Object.keys(dataToUpdate).forEach(_key => {
            cacheData[_key] = dataToUpdate[_key]
        })
        console.log(cacheData)
    })

    return data

}

module.exports = {
    create,
    get,
    getAlive,
    remove,
    collectionName,
    update
}