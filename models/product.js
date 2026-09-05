import mongoose from "mongoose";

const productSchema = mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  altNames: [{ type: String }],
  description: {
    type: String,
    required: true,
  },
  images: {
    type: [{ type: String }],
  },
  labelledPrice: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
});

// The customer product query is always
//   find({ isAvailable: true, price: { $gte, $lte } }).sort({ price })
// so one compound index covers the equality filter + the range + the sort.
// (The regex search on name/altNames is intentionally NOT indexed — for a
// small catalog partial-match regex beats a whole-word text index on UX;
// a text index or Atlas Search is the move once the catalog is large.)
productSchema.index({ isAvailable: 1, price: 1 });

const Product = mongoose.model("products", productSchema);

export default Product;
