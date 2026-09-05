import express from "express";
import rateLimit from "express-rate-limit";
import { createUser, loginUser } from "../controller/userController.js";

const userRouter = express.Router();

// Scoped ONLY to login (not the whole API, not even registration) so a
// normal customer typing a wrong password a couple of times never notices
// this exists — it exists for someone trying hundreds of passwords fast.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

userRouter.post("/", createUser);
userRouter.post("/login", loginLimiter, loginUser);

export default userRouter;
