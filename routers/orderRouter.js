import express from "express";
import { createOrder, getMyOrders, getMyOrderById } from "../controller/orderController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const orderRouter = express.Router();

orderRouter.get("/", requireAuth, getMyOrders);
orderRouter.get("/:orderId", requireAuth, getMyOrderById);
orderRouter.post("/", requireAuth, createOrder);

export default orderRouter;
