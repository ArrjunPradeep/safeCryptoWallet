# Binance Crypto Wallet + NFT

## Setting Up :

**Step 1:** Download the repository using the command:

```
 git clone -b wallet_nft "https://github.com/Arjun-Pradeep/safeCryptoWallet.git"
```

**Step 2:** Change the current working directory to "safeCryptoWallet" :

```
 cd safeCryptoWallet
```

**Step 3:** Install the dependecies :

```
 npm i --save
```

**Step 4:** Load environment variables from **.env** file

```
MNEMONIC=""
PASSPHRASE=""
API_KEY=""
PROVIDER=""
WEBSOCKET_URL=""
PRIVATE_KEY=""
BNB_API_KEY=""
MARKETPLACE_ADDRESS=""
NFT_ADDRESS=""
```

**Step 5:** Install redis :

```
 sudo apt-get install redis

```

**Step 6:** Install pm2 [daemon process manager] :

```
    npm install pm2@latest -g
```

**Step 7:** Compile the smart contracts :

```
 npx hardhat compile
```

**Step 8:** Run redis service [/home Folder] :

```
   pm2 start redis-server
```

**Step 9:** Setup a database in server [MongoDB]:

###### Create a file - database.js [HOME directory] :

```
conn = new Mongo();

dbName = "wallets";

db = conn.getDB(dbName);

db.createUser(
{
user: "cryptoInsider",
pwd: "VB<z6LXP.[f/+c3+",
roles: [ {role:"readWrite", db:dbName} ]
}
);

// ACCOUNTS
printjson(
 db.createCollection("accounts")
 )

// WALLETS
printjson(
 db.createCollection("wallets")
)

// TRANSACTIONS
printjson(
 db.createCollection("transactions")
)

// TOKENS
printjson(
 db.createCollection("tokens")
)

// SETTINGS
printjson(
 db.createCollection("settings")
)

// NFTS
printjson(
 db.createCollection("nfts")
)

// UNIQUE
db.accounts.createIndex({"email":1},{ unique: true } );

// INITIALLY CREATE A ADMIN RECORD
printjson(
db.accounts.insert({
  name: "John",
  email: "cryptowalletadmin@gmail.com",
  adminLevel: "0"
},{
  upsert: true
},
{ unique: true })
)

// UNIQUE
db.settings.createIndex({marketplace_address:1},{ unique: true } );

// SETTINGS
printjson(
db.settings.insert({
  marketplace_address:"0x487e5a79E03545279Cb662115a4Be91D1136cA75",
  nft_address:"0x0920adAAd74e243Bc4AD4A878A7Ded9b0AF91187"
},{
  upsert: true
})
)

// UNIQUE
db.tokens.createIndex({"address":1},{ unique: true } );

// INITIALLY CREATE A SETTINGS
printjson(
db.tokens.insert({
    status: true,
    name: "Bank of BIT ETH",
    symbol: "BOBE",
    address: "0x5F5f52DFdB123af72aBc43ab36c191e05c9E5904",
    decimal: "15",
    blockchain: "binance"
},{
  upsert: true
})
)

// GET COLLECTIONS
printjson(
db.getCollectionNames()
)
```

###### Open mongo terminal :

```
   mongo
```

###### Execute the database.js in mongo terminal :

```
   load('database.js')
```

###### Ensure mongodb is running

**Step 5:** Update the database credentials in '/safeCryptoWallet/config/config.js':

```
    db: {
        host: "localhost",
        port: "27017",
        userName: "DB_USERNAME",
        password: "DB_PASSWORD",
        dbName: "DB_NAME"
    }
```

**Step 6:** Execute the crons :

```
pm2 start crons/startSendCrypto.js --name sendCron
pm2 start crons/receiveTransaction.js --name receiveCron
```

**Step 7:** Start the Application :

```
 pm2 start bin/www --name wallet
```

## Endpoints :

**POSTMAN Collections : https://www.getpostman.com/collections/08bb2c99add9ecf65a47**

**For every API call, Need to set "x-api-key" in the header**

**Create wallet account for a user [/createWallet] [POST]:**

![CREATE WALLET](/docs/wallet/createWallet.png "CREATE WALLET")
```
Body Parameters :

-> email : String

-> password : String

```

**Retrieve account details of a user [/user] [GET]:**

![USER](/docs/wallet/user.png "USER")
```
Query Parameters :

-> email : String

```

**Retrieve transaction history w.r.t user [/transactionHistory] [GET]:**

![TRANSACTION HISTORY](/docs/wallet/transaction.png "TRANSACTION HISTORY")
```
Query Parameters :

-> email : String

```

**Validate the transaction [/validateTransaction] [POST]:**

![VALIDATE](/docs/wallet/validate.png "VALIDATE")
```
Body Parameters :

-> email : String
-> crypto : String // 'BNB' or 'BOBE'
-> receiver : String
-> amount : String

```

**Crypto transaction [/send] [POST]:**

![SEND]/docs/wallet/send.png "SEND")

```
Body Parameters :

-> email : String
-> crypto : String // 'BNB' or 'BOBE'
-> receiver : String
-> amount : String
```
