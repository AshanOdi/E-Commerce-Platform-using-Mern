import express from "express";
import rateLimit from "express-rate-limit";
import { createContactMessage } from "../controller/contactController.js";

const contactRouter = express.Router();

// Public, unauthenticated form — a classic spam target. Same pattern as
// Phase 0's login limiter, scoped only to this route.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many messages sent. Please try again later." },
});

contactRouter.post("/", contactLimiter, createContactMessage);

export default contactRouter;
