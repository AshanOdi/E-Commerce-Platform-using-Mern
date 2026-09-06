import crypto from "crypto";
import PaymentIntent from "../models/paymentIntent.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import { AppError } from "../utils/appError.js";

const WEBHOOK_SECRET = process.env.MOCKPAY_WEBHOOK_SECRET || "dev-mockpay-secret";

function sign(rawBody) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

// --- 1. Customer's checkout asks us to start collecting payment ---
// POST /api/payment/intent  { orderId }   (requireAuth)
export async function createIntent(req, res, next) {
  try {
    const order = await Order.findOne({ orderId: req.body.orderId, userId: req.user.id });
    if (!order) {
      throw new AppError(404, "Order not found");
    }
    if (order.paymentStatus === "paid") {
      throw new AppError(400, "This order is already paid");
    }

    // Reuse a still-payable intent for this order rather than stacking new
    // ones (idempotent at the intent level).
    let intent = await PaymentIntent.findOne({
      orderId: order.orderId,
      status: { $in: ["requires_payment", "processing"] },
    });

    if (!intent) {
      intent = await PaymentIntent.create({
        intentId: "pi_" + crypto.randomBytes(12).toString("hex"),
        orderId: order.orderId,
        userId: req.user.id,
        amount: order.total, // server-side, from the order — never from the client
        currency: "LKR",
        status: "requires_payment",
      });
    }

    res.status(201).json({
      intentId: intent.intentId,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
    });
  } catch (err) {
    next(err);
  }
}

// --- 2. The pay page polls this until it flips ---
// GET /api/payment/intent/:intentId/status   (requireAuth, owner only)
export async function getIntentStatus(req, res, next) {
  try {
    const intent = await PaymentIntent.findOne({
      intentId: req.params.intentId,
      userId: req.user.id,
    });
    if (!intent) {
      throw new AppError(404, "Payment not found");
    }
    res.json({ status: intent.status, orderId: intent.orderId, amount: intent.amount });
  } catch (err) {
    next(err);
  }
}

// --- 3. Simulates the customer completing payment ON THE PROVIDER SIDE ---
// POST /api/payment/mock/charge  { intentId, outcome: "success" | "failure" }
// In a real integration this whole step happens on the gateway's hosted
// page and we never see it. Here it just triggers the provider -> our
// webhook, exactly like a real gateway would.
export async function mockCharge(req, res, next) {
  try {
    const { intentId, outcome } = req.body;

    const intent = await PaymentIntent.findOne({ intentId, userId: req.user.id });
    if (!intent) {
      throw new AppError(404, "Payment not found");
    }
    if (intent.status !== "requires_payment") {
      throw new AppError(409, `Payment is already "${intent.status}"`);
    }

    intent.status = "processing";
    await intent.save();

    // Build the webhook payload the "provider" will send us, sign it, and
    // deliver it server-to-server to our own webhook route — a real HTTP
    // round-trip through the actual handler, signature and all.
    const event = {
      type: outcome === "failure" ? "payment.failed" : "payment.succeeded",
      intentId: intent.intentId,
      amount: intent.amount,
      currency: intent.currency,
      createdAt: new Date().toISOString(),
    };
    const rawBody = JSON.stringify(event);
    const port = process.env.PORT || 5000;

    const webhookRes = await fetch(`http://localhost:${port}/api/payment/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mockpay-signature": sign(rawBody),
      },
      body: rawBody,
    });

    if (!webhookRes.ok) {
      throw new AppError(502, "Payment processing failed");
    }

    const fresh = await PaymentIntent.findOne({ intentId });
    res.json({ status: fresh.status });
  } catch (err) {
    next(err);
  }
}

// --- 4. The webhook: the ONLY place an order becomes "paid" ---
// POST /api/payment/webhook   (NO auth middleware — authenticated by signature)
export async function handleWebhook(req, res, next) {
  try {
    // Verify the signature over the RAW bytes (req.rawBody is captured by
    // express.json's verify hook in index.js). A bad/missing signature is
    // rejected before we trust a single field of the payload.
    const provided = req.header("x-mockpay-signature") || "";
    const expected = sign(req.rawBody || Buffer.from(""));
    const ok =
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { type, intentId } = req.body;
    const intent = await PaymentIntent.findOne({ intentId });
    if (!intent) {
      // Unknown intent — ack so the provider stops retrying.
      return res.status(200).json({ received: true, note: "unknown intent" });
    }

    // Idempotency: webhooks can be delivered more than once. If we've
    // already reached a terminal state for this intent, just ack.
    if (intent.status === "succeeded" || intent.status === "failed") {
      return res.status(200).json({ received: true, note: "already processed" });
    }

    const order = await Order.findOne({ orderId: intent.orderId });

    if (type === "payment.succeeded") {
      intent.status = "succeeded";
      await intent.save();
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        if (order.status === "pending") order.status = "confirmed";
        await order.save();
      }
      return res.status(200).json({ received: true });
    }

    if (type === "payment.failed") {
      intent.status = "failed";
      await intent.save();
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "failed";
        if (order.status !== "cancelled") {
          // Return the reserved stock (same atomic $inc used by an admin
          // cancellation in Phase 7).
          for (const item of order.products) {
            await Product.updateOne(
              { productId: item.productInfo.productId },
              { $inc: { stock: item.quantity } }
            );
          }
          order.status = "cancelled";
        }
        await order.save();
      }
      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true, note: "unhandled event type" });
  } catch (err) {
    next(err);
  }
}
