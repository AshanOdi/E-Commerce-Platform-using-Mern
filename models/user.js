import mongoose from "mongoose";

const userSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    default: "customer",
  },
  isBlocked: {
    type: Boolean,
    default: false,
    required: true,
  },
  phone: {
    type: String,
    required: false,
  },
  address: {
    type: String,
    required: false,
  },
  image: {
    type: String,
    required: false,
    default: "https://avatar.iran.liara.run/public/boy?username=Ash",
  },
  // Just productId strings, not refs to full product docs — resolved against
  // the Product collection on read (getMyWishlist), the same way order line
  // items and cart items already identify products by productId elsewhere
  // in this app rather than by Mongo _id.
  wishlist: {
    type: [{ type: String }],
    default: [],
  },
});

const User = mongoose.model("users", userSchema);
export default User;
