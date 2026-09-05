import express from "express";
import {
  deleteProduct,
  getProduct,
  getProductById,
  saveProduct,
  updateProduct,
} from "../controller/productController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const productRouter = express.Router();

// Public (optionally-authenticated) reads
productRouter.get("/", getProduct);
productRouter.get("/:productId", getProductById);

// Admin-only writes — requireAdmin runs before the controller, so the
// controller no longer needs to check isAdmin(req) itself.
productRouter.post("/", requireAdmin, saveProduct);
productRouter.put("/:productId", requireAdmin, updateProduct);
productRouter.delete("/:productId", requireAdmin, deleteProduct);

export default productRouter;
