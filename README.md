# Binance Crypto Wallet

## Setting Up :

**Step 1:** Download the repository using the command:

```
 git clone "https://github.com/Arjun-Pradeep/safeCryptoWallet.git"
```

**Step 2:** Change the current working directory to "safeCryptoWallet" :

```
 cd safeCryptoWallet
```

**Step 3:** Install the dependecies :

```
 npm i --save
```

**Step 4:** Setup a database in server [MongoDB]:

###### Create a file - database.js [HOME directory] :

```
conn = new Mongo();
db = conn.getDB("cryptowallet");


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

###### Create a user administrator in MongoDB

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

**Step 6:** Install pm2 [daemon process manager] :

```
    npm install pm2@latest -g
```

**Step 7:** Load environment variables from **.env** file
```
MNEMONIC=""
PASSPHRASE=""
API_KEY=""
PROVIDER=""
WEBSOCKET_URL=""
```

**Step 8:** Execute the crons :

```
pm2 start crons/startSendCrypto.js --name sendCron
pm2 start crons/receiveTransaction.js --name receiveCron
```

**Step 9:** Start the Application :

```
 pm2 start bin/www --name wallet
```

## Endpoints :

**POSTMAN Collections : https://www.getpostman.com/collections/08bb2c99add9ecf65a47**

**Create wallet account for a user [/createWallet] [POST]:**

   <p align="left">
<a href="https://ibb.co/q9d3KBk"><img src="https://i.ibb.co/rMmRYk4/create-Wallet.png" alt="create-Wallet" border="0"></a></p>

```
Body Parameters :

-> email : String

-> password : String

```

**Retrieve account details of a user [/user] [GET]:**

   <p align="left">
<a href="https://ibb.co/j4x6fLq"><img src="https://i.ibb.co/WKdx5c7/user.png" alt="user" border="0"></a>
</p>

```
Query Parameters :

-> email : String

```

**Retrieve transaction history w.r.t user [/transactionHistory] [GET]:**

   <p align="left">
   <a href="https://ibb.co/nwgkRNF"><img src="https://i.ibb.co/JcBkCw9/transaction.png" alt="transaction" border="0"></a>
</p>
```

Query Parameters :

-> email : String

```

**Validate the transaction [/validateTransaction] [POST]:**

   <p align="left">
<a href="https://ibb.co/F3ybPpc"><img src="https://i.ibb.co/DWvDqdm/validate.png" alt="validate" border="0"></a></p>
```

Body Parameters :

-> email : String
-> crypto : String // 'BNB' or 'BOBE'
-> amount : String

```

**Crypto transaction [/send] [POST]:**

   <p align="left">
<a href="https://ibb.co/KL95rg8"><img src="https://i.ibb.co/RBCgDKJ/send.png" alt="send" border="0"></a>
</p>
```

Body Parameters :

-> email : String
-> crypto : String // 'BNB' or 'BOBE'
-> receiver : String
-> amount : String
