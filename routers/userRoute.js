import express from "express";
import { createUser } from "../controller/userController.js";

const userRouter = express.Router();

userRouter.post("/", createUser);

export default userRouter;
