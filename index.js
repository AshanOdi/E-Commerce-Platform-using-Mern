import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import studentRouter from "./routers/studentRouter.js";
import userRouter from "./routers/userRoute.js";
import productRouter from "./routers/productRoutes.js";
import jwt from "jsonwebtoken";

const app = express();

app.use(bodyParser.json());

app.use((req, res, next) => {
  const tokenString = req.header("Authorization");
  // console.log(tokenString);
  if (tokenString != null) {
    const token = tokenString.replace("Bearer ", "");
    // console.log(token);
    jwt.verify(token, "2021E018", (err, decoded) => {
      if (decoded != null) {
        req.user = decoded;
        next();
      } else {
        res.status(403).json({
          message: "invalid token",
        });
      }
    });
  } else {
    next();
  }
});

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
app.use("/product", productRouter);

app.listen(5000, () => {
  console.log("This server is running on Port 5000");
});

// mongodb+srv://admin:1234@cluster0.8uomnzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
