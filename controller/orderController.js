import Order from "../models/order.js";
import Product from "../models/product.js";
import { AppError } from "../utils/appError.js";

export async function createOrder(req, res, next) {
  // Note: requireAuth middleware already guarantees req.user exists before
  // this runs (see routers/orderRouter.js) — replaces the old manual check.
  const orderInfo = req.body;

  // Tracks {productId, Qty} for every item we've successfully, atomically
  // decremented so far in THIS order attempt — if anything later in this
  // function fails, we compensate by adding the stock back for each of
  // these, so a failed order never leaves stock permanently short.
  const decremented = [];

  try {
    if (!Array.isArray(orderInfo.products) || orderInfo.products.length === 0) {
      throw new AppError(400, "products must be a non-empty array");
    }
    if (!orderInfo.address || !orderInfo.phone) {
      throw new AppError(400, "address and phone are required");
    }

    if (orderInfo.name == null) {
      orderInfo.name = req.user.firstName + " " + req.user.lastName;
    }

    let total = 0;
    let labelledTotal = 0;
    const products = [];

    for (let i = 0; i < orderInfo.products.length; i++) {
      const { productId, Qty } = orderInfo.products[i];

      if (!productId || typeof Qty !== "number" || Qty <= 0) {
        throw new AppError(
          400,
          `Invalid product entry at index ${i}: productId and a positive Qty are required`
        );
      }

      // Atomic, race-condition-proof stock check-and-decrement: the "is
      // there enough stock" condition and the "take it" write happen as
      // ONE database operation. Two concurrent requests for the last unit
      // can't both read "stock = 1, OK" and both decrement — only one
      // request's query can still match by the time MongoDB applies it;
      // the other gets null back, as if the condition was never true.
      const updated = await Product.findOneAndUpdate(
        { productId, isAvailable: true, stock: { $gte: Qty } },
        { $inc: { stock: -Qty } },
        { new: true }
      );

      if (!updated) {
        // The atomic update above already made the real decision (no
        // stock was taken). This second read is ONLY to build a helpful
        // error message — it doesn't affect correctness either way.
        const existing = await Product.findOne({ productId });
        if (!existing) {
          throw new AppError(404, `Product with productId ${productId} not found`);
        }
        if (!existing.isAvailable) {
          throw new AppError(400, `Product with productId ${productId} is not available right now`);
        }
        throw new AppError(
          409,
          `Only ${existing.stock} unit(s) of ${existing.name} left in stock`
        );
      }

      decremented.push({ productId, Qty });

      products[i] = {
        productInfo: {
          productId: updated.productId,
          name: updated.name,
          altNames: updated.altNames,
          description: updated.description,
          images: updated.images,
          labelledPrice: updated.labelledPrice,
          price: updated.price,
        },
        quantity: Qty,
      };
      total += updated.price * Qty;
      labelledTotal += updated.labelledPrice * Qty;
    }

    // Order ID is only allocated once every item's stock is secured — the
    // loser of a stock race above never reaches this point, so it can't
    // collide with the winner over the "next" order number.
    let orderId = "CBC00001";
    const lastOrder = await Order.find().sort({ date: -1 }).limit(1);
    if (lastOrder.length > 0) {
      const lastOrderNumberString = lastOrder[0].orderId.replace("CBC", "");
      const newOrderNumber = parseInt(lastOrderNumberString) + 1;
      orderId = "CBC" + newOrderNumber.toString().padStart(5, "0");
    }

    const order = new Order({
      orderId,
      name: orderInfo.name,
      address: orderInfo.address,
      phone: orderInfo.phone,
      email: req.user.email,
      total,
      labelledTotal,
      products,
    });

    const createdOrder = await order.save();
    res.status(201).json({ message: "Order created successfully", order: createdOrder });
  } catch (err) {
    // Compensate: give back every unit this (failed) order attempt took,
    // so a rejected order never leaves the catalog permanently short.
    for (const item of decremented) {
      await Product.updateOne({ productId: item.productId }, { $inc: { stock: item.Qty } });
    }
    next(err);
  }
}
