import Product from "../models/product.js";
import { isAdmin } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/appError.js";

export async function getProduct(req, res, next) {
  try {
    // Soft check, not a hard gate: everyone can list products, admins just
    // see unavailable ones too. This is why this route has no requireAdmin.
    const filter = isAdmin(req.user) ? {} : { isAvailable: true };
    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function saveProduct(req, res, next) {
  // Note: requireAdmin middleware already blocked non-admins before this
  // controller runs (see routers/productRoutes.js) — no manual check needed here.
  try {
    const { productId, name, description, labelledPrice, price, stock } = req.body;

    if (!productId || !name || !description) {
      throw new AppError(400, "productId, name and description are required");
    }
    if (typeof price !== "number" || price <= 0) {
      throw new AppError(400, "price must be a positive number");
    }
    if (typeof labelledPrice !== "number" || labelledPrice <= 0) {
      throw new AppError(400, "labelledPrice must be a positive number");
    }
    if (typeof stock !== "number" || stock < 0) {
      throw new AppError(400, "stock must be a non-negative number");
    }

    const product = new Product(req.body);
    await product.save();

    res.status(201).json({ message: "Product added successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const result = await Product.deleteOne({ productId: req.params.productId });
    if (result.deletedCount === 0) {
      throw new AppError(404, "Product not found");
    }
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const productId = req.params.productId;
    const updatingData = req.body;

    if (
      updatingData.price !== undefined &&
      (typeof updatingData.price !== "number" || updatingData.price <= 0)
    ) {
      throw new AppError(400, "price must be a positive number");
    }
    if (
      updatingData.stock !== undefined &&
      (typeof updatingData.stock !== "number" || updatingData.stock < 0)
    ) {
      throw new AppError(400, "stock must be a non-negative number");
    }

    const result = await Product.updateOne({ productId }, updatingData);
    if (result.matchedCount === 0) {
      throw new AppError(404, "Product not found");
    }

    res.json({ message: "Product updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const product = await Product.findOne({ productId: req.params.productId });

    // Resource does not exist -> a normal, expected 404.
    if (!product) {
      throw new AppError(404, "Product not found");
    }
    // Exists but hidden from non-admins -> same 404, so we don't leak
    // "this productId exists but you can't see it" to a random visitor.
    if (!product.isAvailable && !isAdmin(req.user)) {
      throw new AppError(404, "Product not found");
    }

    res.json(product);
  } catch (err) {
    // Any *unexpected* DB failure lands here too, and now always gets a
    // response via the central error handler — it can never hang again.
    next(err);
  }
}
