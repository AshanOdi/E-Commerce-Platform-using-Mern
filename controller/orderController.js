import Order from "../models/order.js";
import Product from "../models/product.js";
import { AppError } from "../utils/appError.js";

export async function createOrder(req, res, next) {
  // Note: requireAuth middleware already guarantees req.user exists before
  // this runs (see routers/orderRouter.js) — replaces the old manual check.
  try {
    const orderInfo = req.body;

    if (!Array.isArray(orderInfo.products) || orderInfo.products.length === 0) {
      throw new AppError(400, "products must be a non-empty array");
    }
    if (!orderInfo.address || !orderInfo.phone) {
      throw new AppError(400, "address and phone are required");
    }

    if (orderInfo.name == null) {
      orderInfo.name = req.user.firstName + " " + req.user.lastName;
    }

    let orderId = "CBC00001";
    const lastOrder = await Order.find().sort({ date: -1 }).limit(1);
    if (lastOrder.length > 0) {
      const lastOrderNumberString = lastOrder[0].orderId.replace("CBC", "");
      const newOrderNumber = parseInt(lastOrderNumberString) + 1;
      orderId = "CBC" + newOrderNumber.toString().padStart(5, "0");
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

      const item = await Product.findOne({ productId });
      if (!item) {
        throw new AppError(404, `Product with productId ${productId} not found`);
      }
      if (!item.isAvailable) {
        throw new AppError(400, `Product with productId ${productId} is not available right now`);
      }

      products[i] = {
        productInfo: {
          productId: item.productId,
          name: item.name,
          altNames: item.altNames,
          description: item.description,
          images: item.images,
          labelledPrice: item.labelledPrice,
          price: item.price,
        },
        quantity: Qty,
      };
      total += item.price * Qty;
      labelledTotal += item.labelledPrice * Qty;
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
    next(err);
  }
}
