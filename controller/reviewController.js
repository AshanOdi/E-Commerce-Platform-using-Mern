import Review from "../models/review.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import { AppError } from "../utils/appError.js";

const MAX_COMMENT = 1000;

function validateRating(rating) {
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError(400, "rating must be a whole number from 1 to 5");
  }
}

function validateComment(comment) {
  if (typeof comment !== "string" || comment.trim() === "") {
    throw new AppError(400, "comment is required");
  }
  if (comment.length > MAX_COMMENT) {
    throw new AppError(400, `comment must be ${MAX_COMMENT} characters or fewer`);
  }
}

// GET /api/review/:productId — public. Returns the product's reviews
// (newest first) plus an aggregated rating summary.
export async function getProductReviews(req, res, next) {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ productId }).sort({ date: -1 });

    // One aggregation pass: group by star value, then derive average /
    // count / distribution from that in JS.
    const byRating = await Review.aggregate([
      { $match: { productId } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0;
    let sum = 0;
    for (const row of byRating) {
      distribution[row._id] = row.count;
      count += row.count;
      sum += row._id * row.count;
    }
    const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

    res.json({ reviews, summary: { average, count, distribution } });
  } catch (err) {
    next(err);
  }
}

// POST /api/review — requireAuth. Body { productId, rating, comment }.
export async function createReview(req, res, next) {
  try {
    if (!req.user.id) {
      throw new AppError(401, "Please log in again to post a review");
    }

    const { productId, rating, comment } = req.body;

    if (!productId) {
      throw new AppError(400, "productId is required");
    }
    validateRating(rating);
    validateComment(comment);

    const productExists = await Product.exists({ productId });
    if (!productExists) {
      throw new AppError(404, "Product not found");
    }

    // Verified purchase = this user has an order that contains this product.
    const hasBought = await Order.exists({
      userId: req.user.id,
      "products.productInfo.productId": productId,
    });

    const review = new Review({
      productId,
      userId: req.user.id,
      userName: (req.user.firstName + " " + req.user.lastName).trim(),
      rating,
      comment: comment.trim(),
      isVerifiedPurchase: !!hasBought,
    });

    await review.save();
    res.status(201).json({ message: "Review added", review });
  } catch (err) {
    // The { productId, userId } unique index rejects a second review.
    if (err.code === 11000) {
      return next(new AppError(409, "You have already reviewed this product"));
    }
    next(err);
  }
}

// PATCH /api/review/:reviewId — requireAuth, owner only.
export async function updateReview(req, res, next) {
  try {
    if (!req.user.id) {
      throw new AppError(401, "Please log in again");
    }

    const { rating, comment } = req.body;
    if (rating !== undefined) validateRating(rating);
    if (comment !== undefined) validateComment(comment);

    // Match on _id AND userId — someone else's review comes back like a
    // missing one (404), never a 403 that would confirm it exists.
    const review = await Review.findOne({ _id: req.params.reviewId, userId: req.user.id });
    if (!review) {
      throw new AppError(404, "Review not found");
    }

    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment.trim();
    await review.save();

    res.json({ message: "Review updated", review });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/review/:reviewId — requireAuth, owner only.
export async function deleteReview(req, res, next) {
  try {
    if (!req.user.id) {
      throw new AppError(401, "Please log in again");
    }

    const result = await Review.deleteOne({
      _id: req.params.reviewId,
      userId: req.user.id,
    });
    if (result.deletedCount === 0) {
      throw new AppError(404, "Review not found");
    }

    res.json({ message: "Review deleted" });
  } catch (err) {
    next(err);
  }
}
