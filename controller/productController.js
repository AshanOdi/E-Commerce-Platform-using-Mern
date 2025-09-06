import Product from "../models/product.js";
import { isAdmin } from "./userController.js";

export async function getProduct(req, res) {
  //   Product.find().then((data) => {
  //     res.json(data);
  //   }).catch(
  //     (err)=>{
  //         res.json({
  //             message: "Failed to get Product",
  //             error : err
  //         })
  //     }
  //   );
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
