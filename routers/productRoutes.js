import express from "express";
import {
  deleteProduct,
  getProduct,
  getProductById,
  saveProduct,
  updateProduct,
} from "../controller/productController.js";

const productRouter = express.Router();

productRouter.get("/", getProduct);
productRouter.post("/", saveProduct);
productRouter.delete("/:productId", deleteProduct);
productRouter.put("/:productId", updateProduct);
productRouter.get("/:productId", getProductById);

export default productRouter;
