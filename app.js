const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const config = require("./config/config");

// D A T A B A S E    C O N N E C T I O N  -  M O N G O D B
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
    config.db.dbName

    ).then(async(res) => {

    console.log(":::::::  MONGODB CONNECTED :::::::");

}).catch((error) => {

    console.log("::::::: MONGODB NOT CONNECTED :::::::");

})

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

module.exports = app;
