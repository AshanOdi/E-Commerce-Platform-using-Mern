import Order from "../models/order.js";
import Product from "../models/product.js";

export async function createOrder(req, res) {
  //get user info
  //add current users name if not provided
  //generate order ID
  //create order object

  //get user info
  if (req.user == null) {
    res.status(403).json({
      message: "please login and try again",
    });
    return;
  }
  const orderInfo = req.body;
  if (orderInfo.name == null) {
    orderInfo.name = req.user.firstName + " " + req.user.lastName;
  }
  //CBC00001
  let orderId = "CBC00001";

  const lastOrder = await Order.find().sort({ date: -1 }).limit(1);
  if (lastOrder.length > 0) {
    const lastOrderid = lastOrder[0].orderId; //CBC00551
    const lastOrderNumberString = lastOrderid.replace("CBC", ""); // 00551
    const lastOrderNumber = parseInt(lastOrderNumberString); // 551
    const newOrderNumber = lastOrderNumber + 1; // 552
    const newOrderNumberString = newOrderNumber.toString().padStart(5, "0"); // 00552
    //const newOrderNumberString = String(newOrderNumber).padStart(5,"0"); // 00552
    orderId = "CBC" + newOrderNumberString; // CBC00552
  }

  try {
    let total = 0;
    let labelledTotal = 0;
    const products = [];

    for (let i = 0; i < orderInfo.products.length; i++) {
      const item = await Product.findOne({
        productId: orderInfo.products[i].productId,
      });
      if (item == null) {
        res.status(404).json({
          message:
            "productwith productId " +
            orderInfo.products[i].productId +
            " not found",
        });
        return;
      }
      if (item.isAvailable == false) {
        res.status(404).json({
          message:
            "product with productId " +
            orderInfo.products[i].productId +
            " is not available right now",
        });
        return;
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
        quantity: orderInfo.products[i].Qty,
      };
      total += item.price * orderInfo.products[i].Qty;
      labelledTotal += item.labelledPrice * orderInfo.products[i].Qty;
    }

    const order = new Order({
      orderId: orderId,
      name: orderInfo.name,
      address: orderInfo.address,
      phone: orderInfo.phone,
      email: req.user.email,
      total: 0,
      products: products,
      labelledTotal: labelledTotal,
      total: total,
    });

    const createdOrder = await order.save();
    res.json({
      message: "Order created successfully",
      order: createdOrder,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error creating order",
      error: err,
    });
  }
}
