import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";

const app = express();

app.use(bodyParser.json());

mongoose
  .connect(
    "mongodb+srv://admin:1234@cluster0.8uomnzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => {
    console.log("connected to database");
  })
  .catch(() => {
    console.log("database connection error");
  });

app.get("/", (req, res) => {
  console.log(req.body.name);
});

app.delete("/", (req, res) => {
  console.log(req.body);
});

app.post("/", (req, res) => {
  res.json({
    message: "this is response of post request",
  });
});

app.put("/", (req, res) => {
  res.json({
    message: "this is response of put request",
  });
});

app.listen(5000, () => {
  console.log("This server is running on Port 5000");
});

// mongodb+srv://admin:1234@cluster0.8uomnzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
