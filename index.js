import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import Student from "./models/student.js";

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

app.post("/", (req, res) => {
  const student = new Student({
    name: req.body.name,
    age: req.body.age,
    stream: req.body.stream,
    email: req.body.email,
  });

  student
    .save()
    .then(() => {
      res.json({
        message: "Successfully Added Student",
      });
    })
    .catch(() => {
      res.json({
        message: "Failed to Add Student",
      });
    });
});

app.get("/", (req, res) => {
  Student.find().then((data) => {
    res.json(data);
  });
});

app.listen(5000, () => {
  console.log("This server is running on Port 5000");
});

// mongodb+srv://admin:1234@cluster0.8uomnzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
