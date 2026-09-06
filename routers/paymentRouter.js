import express from "express";
import {
  createIntent,
  getIntentStatus,
  mockCharge,
  handleWebhook,
} from "../controller/paymentController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const paymentRouter = express.Router();

// Customer-facing
paymentRouter.post("/intent", requireAuth, createIntent);
paymentRouter.get("/intent/:intentId/status", requireAuth, getIntentStatus);
paymentRouter.post("/mock/charge", requireAuth, mockCharge);

// Provider -> us. NO auth middleware: a webhook is not a logged-in user,
// it authenticates by signing the payload with a shared secret.
paymentRouter.post("/webhook", handleWebhook);

export default paymentRouter;
