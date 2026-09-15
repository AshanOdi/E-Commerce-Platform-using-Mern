import express from "express";
import rateLimit from "express-rate-limit";
import { getRecommendations } from "../controller/recommendController.js";

const recommendRouter = express.Router();

// Public (a guest browsing should be able to try the concierge too, same
// as the cart), but each call is a real, billed LLM request and noticeably
// slower than a normal route — rate-limited tighter than the login/contact
// limiters for that reason.
const recommendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many recommendation requests. Please try again in a few minutes." },
});

recommendRouter.post("/", recommendLimiter, getRecommendations);

export default recommendRouter;
