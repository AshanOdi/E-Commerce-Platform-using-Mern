import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import studentRouter from "./routers/studentRouter.js";
import userRouter from "./routers/userRoute.js";
import productRouter from "./routers/productRoutes.js";
import jwt from "jsonwebtoken";
import orderRouter from "./routers/orderRouter.js";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  const tokenString = req.header("Authorization");
  // console.log(tokenString);
  if (tokenString != null) {
    const token = tokenString.replace("Bearer ", "");
    // console.log(token);
    jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
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
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("connected to database");
  })
  .catch(() => {
    console.log("database connection error");
  });

app.use("/api/student", studentRouter);
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/order", orderRouter);

app.listen(5000, () => {
  console.log("This server is running on Port 5000");
});

// mongodb+srv://admin:1234@cluster0.8uomnzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
