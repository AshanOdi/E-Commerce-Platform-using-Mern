import express from "express";
import Student from "../models/student.js";

const studentRouter = express.Router();

studentRouter.post("/", (req, res) => {
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
    .catch((err) => {
      console.error(err);
      res.status(500).json({
        message: "Failed to Add Student",
        error: err.message,
      });
    });
});

studentRouter.get("/", (req, res) => {
  Student.find().then((data) => {
    res.json(data);
  });
});

export default studentRouter;
