import Product from "../models/product.js";
import { isAdmin } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/appError.js";

// Escape regex metacharacters so a user typing "(" or "." can't break the
// pattern or cause catastrophic backtracking.
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORT_MAP = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
};

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

export async function getProduct(req, res, next) {
  try {
    const { search, minPrice, maxPrice, sort } = req.query;

    const filter = {};

    // Soft check, not a hard gate: everyone lists products, admins also see
    // unavailable ones. This is why the route has no requireAdmin.
    if (!isAdmin(req.user)) {
      filter.isAvailable = true;
    }

    // Case-insensitive partial-match search over name + alt names.
    // typeof guard: with Express's default query parser, ?search[$ne]=x
    // arrives as an object, not a string.
    if (typeof search === "string" && search.trim() !== "") {
      const rx = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [{ name: rx }, { altNames: rx }];
    }

    // Price range — only whichever bound(s) were actually supplied.
    const priceFilter = {};
    if (minPrice !== undefined && !isNaN(Number(minPrice))) {
      priceFilter.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
      priceFilter.$lte = Number(maxPrice);
    }
    if (Object.keys(priceFilter).length > 0) {
      filter.price = priceFilter;
    }

    // Sort — whitelist only; anything else (including an injected object)
    // falls back to the default.
    const sortSpec = SORT_MAP[sort] || SORT_MAP.name_asc;

    // Pagination — page >= 1, limit clamped to [1, MAX_LIMIT].
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortSpec).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
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
