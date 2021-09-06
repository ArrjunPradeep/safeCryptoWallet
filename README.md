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

**Step 3:**  Install the dependecies :  
```
 npm i --save
 ```

 **Step 4:**  Setup a database in server [MongoDB]:  


 **Step 5:**  Update the database credentials in '/safeCryptoWallet/config/config.js':  
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

   **Step 7:** Execute the crons :  
```
pm2 start crons/startSendCrypto.js --name sendCron
pm2 start crons/receiveTransaction.js --name receiveCron
 ```


   **Step 8:** Start the Application  :  
```
 pm2 start bin/www --name wallet
 ```

## Endpoints : 
   **Create a wallet account for a user [POST]:**  
```
createWallet
 ```
