const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const config = require("./config/config");
const cors = require('cors');

// D A T A B A S E    C O N N E C T I O N  -  M O N G O D B
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

mongoose.connect(

  "mongodb://" +
  config.db.userName +
  ":" +
  config.db.password +
  "@" +
  config.db.host +
  ":" +
  config.db.port +
  "/" +
  config.db.dbName,
  {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
  }
).then(async (res) => {

  console.log(":::::::  MONGODB CONNECTED :::::::");

}).catch((error) => {

  console.log("::::::: MONGODB NOT CONNECTED :::::::");

})

const userRouter = require("./routes/user");
const adminRouter = require("./routes/admin");
const nftRouter = require("./routes/nft");

const app = express();

app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", userRouter);
app.use("/admin", adminRouter);
app.use("/nft", nftRouter);

module.exports = app;