import mongoose from "mongoose";

const reviewSchema = mongoose.Schema({
  // String link to Product.productId — same style the Order model uses to
  // point at products.
  productId: {
    type: String,
    required: true,
  },
  // Reference (ownership) — always resolves to the current user record.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  // Snapshot of the reviewer's name at review time, so a reviews list
  // renders without a join (same reasoning as the Order product snapshot).
  userName: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  // Computed once at creation from the user's order history.
  isVerifiedPurchase: {
    type: Boolean,
    default: false,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// One review per user per product — enforced at the DB level, not just in
// app code, so a race between two concurrent POSTs can't create duplicates.
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Serves "give me this product's reviews, newest first".
reviewSchema.index({ productId: 1, date: -1 });

const Review = mongoose.model("reviews", reviewSchema);

export default Review;
