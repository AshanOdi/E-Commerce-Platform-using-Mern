import Product from "../models/product.js";
import { isAdmin } from "./userController.js";

export async function getProduct(req, res) {
  //   Product.find()
  //     .then((data) => {
  //       res.json(data);
  //     })
  //     .catch((err) => {
  //       res.json({
  //         message: "Failedmm to get Product",
  //         error: err,
  //       });
  //     });
  try {
    if (isAdmin(req)) {
      const products = await Product.find();
      res.json(products);
    } else {
      const products = await Product.find({ isAvailable: true });
      res.json(products);
    }
  } catch (err) {
    res.json({
      message: "Failed to get Products",
      error: err.message,
    });
  }
}

export function saveProduct(req, res) {
  //   console.log(req.user);
  //   console.log(req.body);

  if (!isAdmin(req)) {
    res.status(403).json({
      message: "You are not authorized to add product",
    });
    return;
  }

  const product = new Product(req.body);

  product
    .save()
    .then(() => {
      res.json({
        message: "Product addedd successfully",
      });
    })
    .catch(() => {
      res.json({
        message: "Product adding fail",
      });
    });
}

export async function deleteProduct(req, res) {
  if (!isAdmin(req)) {
    res.status(403).json({
      message: "You are not authorized to delete products",
    });
    return;
  }
  try {
    await Product.deleteOne({ productId: req.params.productId });

    res.json({
      message: "Product deleted successfully",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error deleting product",
      error: err.message,
    });
  }
}

export async function updateProduct(req, res) {
  if (!isAdmin(req)) {
    res.status(403).json({
      message: "You are not authorized to update products",
    });
    return;
  }

  const productId = req.params.productId;
  const updatingData = req.body;
  try {
    await Product.updateOne({ productId: productId }, updatingData);

    res.json({
      message: "Product updated sucessfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Internal server error",
      error: err,
    });
  }
}
