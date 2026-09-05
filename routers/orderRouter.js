import express from "express";
import {
  createOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  getAnyOrderById,
  updateOrderStatus,
} from "../controller/orderController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const orderRouter = express.Router();

// Customer: own orders only
orderRouter.get("/", requireAuth, getMyOrders);

// Admin: all orders / any single order. Registered BEFORE "/:orderId" so
// the literal path "/all" isn't captured as orderId="all".
orderRouter.get("/all", requireAdmin, getAllOrders);
orderRouter.get("/all/:orderId", requireAdmin, getAnyOrderById);

// Customer: own single order
orderRouter.get("/:orderId", requireAuth, getMyOrderById);

// Customer: place an order
orderRouter.post("/", requireAuth, createOrder);

// Admin: change an order's status (validated against the state machine)
orderRouter.patch("/:orderId/status", requireAdmin, updateOrderStatus);

export default orderRouter;
