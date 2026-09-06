import mongoose from "mongoose";

// Mirrors a real gateway's "PaymentIntent" (Stripe) / "payment session":
// a server-created record that says "we are trying to collect £X for
// order Y". The amount is fixed server-side from the order total — the
// client never gets to say what it owes.
const paymentIntentSchema = mongoose.Schema({
  intentId: {
    type: String,
    required: true,
    unique: true,
  },
  orderId: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "LKR",
  },
  // requires_payment -> processing -> succeeded | failed
  status: {
    type: String,
    enum: ["requires_payment", "processing", "succeeded", "failed"],
    default: "requires_payment",
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// One live intent per order — createIntent reuses an existing
// still-payable intent instead of stacking new ones.
paymentIntentSchema.index({ orderId: 1 });

const PaymentIntent = mongoose.model("paymentintents", paymentIntentSchema);

export default PaymentIntent;
