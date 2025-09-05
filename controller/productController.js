import Product from "../models/product.js";

export function getProduct(req, res) {
  Product.find().then((data) => {
    res.json(data);
  });
}

export function saveProduct(req, res) {
  console.log(req.body);

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
