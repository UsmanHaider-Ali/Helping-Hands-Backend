const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");

const databaseConnection = require("./databases/database-configuration.js");

const userRoutes = require("./routes/user-routes");
const campaignRoutes = require("./routes/campaign-routes.js");
const categoryRoutes = require("./routes/category-routes.js");
const questionRoutes = require("./routes/question-routes.js");
const answerRoutes = require("./routes/answer-routes.js");

databaseConnection.databaseConnection();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.use("/storage/images/profile", express.static("storage/images/profile"));

app.use("/user", userRoutes);
app.use("/campaign", campaignRoutes);
app.use("/category", categoryRoutes);
app.use("/question", questionRoutes);
app.use("/answer", answerRoutes);

module.exports = app;
