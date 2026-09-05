import User from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { isAdmin } from "../middleware/authMiddleware.js";
import { AppError } from "../utils/appError.js";

dotenv.config();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function createUser(req, res, next) {
  try {
    const { email, firstName, lastName, password, role } = req.body;

    if (!email || !firstName || !lastName || !password) {
      throw new AppError(400, "email, firstName, lastName and password are required");
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError(400, "Invalid email format");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    // Authorization check: creating an admin account requires already being
    // logged in as an admin. req.user is set by authenticateUser (or is
    // null for an anonymous request) — this replaces the old req.User typo.
    if (role === "admin" && !isAdmin(req.user)) {
      throw new AppError(
        403,
        "You are not authorized to create an admin account. Please log in as an admin first."
      );
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role, // undefined falls back to the schema default ("customer")
    });

    await user.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    next(err);
  }
}

export async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, "email and password are required");
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const isPasswordCorrect = bcrypt.compareSync(password, user.password);
    if (!isPasswordCorrect) {
      throw new AppError(401, "Invalid password");
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        image: user.image,
      },
      process.env.JWT_KEY,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
}
