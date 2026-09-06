import express from "express";
import {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
} from "../controller/reviewController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const reviewRouter = express.Router();

// Public: a product's reviews + rating summary.
reviewRouter.get("/:productId", getProductReviews);

// Authenticated: write / edit / remove your own review.
reviewRouter.post("/", requireAuth, createReview);
reviewRouter.patch("/:reviewId", requireAuth, updateReview);
reviewRouter.delete("/:reviewId", requireAuth, deleteReview);

export default reviewRouter;
