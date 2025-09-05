import express from "express";
import { saveStudent, getStudent } from "../controller/studentController.js";

const studentRouter = express.Router();

studentRouter.post("/", saveStudent);

studentRouter.get("/", getStudent);

export default studentRouter;
