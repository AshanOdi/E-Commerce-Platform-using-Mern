import Product from "../models/product.js";

export async function getProduct(req, res) {
  //   Product.find().then((data) => {
  //     res.json(data);
  //   }).catch(
  //     (err)=>{
  //         res.json({
  //             message: "Failed to get Product",
  //             error : err
  //         })
  //     }
  //   );

  try {
    const product = await Product.find();
    req.json(product);
  } catch (err) {
    res.json({
      message: "Failed to get Products",
      error: err,
    });
  }
}

export function saveProduct(req, res) {
  //   console.log(req.user);
  if (req.user == null) {
    res.status(403).json({
      message: "Unauthorized",
    });
    return;
  }

  if (req.user.role != "admin") {
    res.status(403).json({
      message: "Unauthorized You need to be an admin",
    });
    return;
  }
  //   console.log(req.body);

  const product = new Product({
    name: req.body.name,
    price: req.body.price,
    description: req.body.description,
    image: req.body.image,
  });

  product
    .save()
    .then(() => {
      res.json({
        message: "Product addedd successfully",
      });
    })
    .catch(() => {
      res.json({
        message: "Product adding fail",
      });
    });
}

export function saveStudent(req, res) {
  const student = new Student({
    name: req.body.name,
    age: req.body.age,
    stream: req.body.stream,
    email: req.body.email,
  });

  student
    .save()
    .then(() => {
      res.json({
        message: "Successfully Added Student",
      });
    })
    .catch(() => {
      res.json({
        message: "Failed to Add Student",
      });
    });
}
