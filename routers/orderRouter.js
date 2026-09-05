import express from "express";
import { createOrder } from "../controller/orderController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const orderRouter = express.Router();

orderRouter.post("/", requireAuth, createOrder);

export default orderRouter;
