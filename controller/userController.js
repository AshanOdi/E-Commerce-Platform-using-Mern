import User from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export function createUser(req, res) {
  if (req.body.role == "admin") {
    if (req.User != null) {
      if (req.body.role !== "admin") {
        res.status(403).json({
          message:
            "you are not authorized to create an admin.please login first",
        });
        return;
      }
    } else {
      res.status(403).json({
        message: "you are not authorized to create an admin.please login first",
      });
      return;
    }
  }

  const hashedPassword = bcrypt.hashSync(req.body.password, 10);

  const user = new User({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: hashedPassword,
    role: req.body.role,
  });

  user
    .save()
    .then(() => {
      res.json({
        message: "User created successfully",
      });
    })
    .catch((err) => {
      console.log(err);
      res.json({
        message: "Error creating user",
        error: err.message,
      });
    });
}

export function loginUser(req, res) {
  const email = req.body.email;
  const password = req.body.password;

  User.findOne({ email: email }).then((user) => {
    if (user == null) {
      res.status(404).json({
        message: "User not Found",
      });
    } else {
      const isPasswordCorrect = bcrypt.compareSync(password, user.password);
      if (isPasswordCorrect) {
        const token = jwt.sign(
          {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            image: user.image,
          },
          "2021E018"
        );
        res.json({
          message: "Login Successful",
          token: token,
        });
      } else {
        res.json({
          message: "Invalid Pssword",
        });
      }
    }
  });
}
