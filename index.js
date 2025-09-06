import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import studentRouter from "./routers/studentRouter.js";
import userRouter from "./routers/userRoute.js";

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

app.use("/student", studentRouter);
app.use("/user", userRouter);

app.listen(5000, () => {
  console.log("This server is running on Port 5000");
});

// mongodb+srv://admin:1234@cluster0.8uomnzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
