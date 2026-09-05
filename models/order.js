import mongoose from "mongoose";

const orderSchema = mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
  }, //CBC003
  // Reference, not a snapshot: ownership should always resolve to the
  // CURRENT user record, unlike productInfo below which deliberately
  // freezes what was true at purchase time.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: "pending",
  },
  labelledTotal: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  products: [
    {
      productInfo: {
        productId: {
          type: String,
          required: true,
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
        Images: {
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
      },
      quantity: {
        type: Number,
        required: true,
      },
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model("orders", orderSchema);

export default Order;
