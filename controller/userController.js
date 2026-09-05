import User from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { AppError } from "../utils/appError.js";

dotenv.config();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Strip the password before sending a user document to a client.
function publicUser(userDoc) {
  const obj = userDoc.toObject();
  delete obj.password;
  return obj;
}

export async function createUser(req, res, next) {
  try {
    const { email, firstName, lastName, password } = req.body;

    if (!email || !firstName || !lastName || !password) {
      throw new AppError(400, "email, firstName, lastName and password are required");
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError(400, "Invalid email format");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    // Public registration ALWAYS creates a customer. `role` is never read
    // from the request body here — the endpoint has no way to grant
    // privilege. Admins are promoted via PATCH /api/user/:userId/role
    // (requireAdmin), and the very first admin is seeded directly in the DB.
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      // role omitted -> schema default "customer"
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

    // Checked AFTER the password so a blocked account isn't revealed to
    // someone who doesn't even have the right credentials.
    if (user.isBlocked) {
      throw new AppError(403, "Your account has been blocked. Please contact support.");
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

// --- Admin-only user management (routes gated by requireAdmin) ---

export async function getAllUsers(req, res, next) {
  try {
    const users = await User.find({}, "-password").sort({ role: 1, email: 1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function setUserBlocked(req, res, next) {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== "boolean") {
      throw new AppError(400, "isBlocked must be true or false");
    }

    const target = await User.findById(userId);
    if (!target) {
      throw new AppError(404, "User not found");
    }
    if (target._id.toString() === req.user.id) {
      throw new AppError(400, "You cannot block your own account");
    }

    // Blocking an admin stops them logging in — if they're the only active
    // admin left, that locks everyone out of admin functions.
    if (isBlocked && target.role === "admin") {
      const otherActiveAdmins = await User.countDocuments({
        role: "admin",
        isBlocked: false,
        _id: { $ne: target._id },
      });
      if (otherActiveAdmins === 0) {
        throw new AppError(400, "Cannot block the last active admin");
      }
    }

    target.isBlocked = isBlocked;
    await target.save();

    res.json({
      message: isBlocked ? "User blocked" : "User unblocked",
      user: publicUser(target),
    });
  } catch (err) {
    next(err);
  }
}

export async function setUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (role !== "admin" && role !== "customer") {
      throw new AppError(400, 'role must be "admin" or "customer"');
    }

    const target = await User.findById(userId);
    if (!target) {
      throw new AppError(404, "User not found");
    }
    if (target._id.toString() === req.user.id) {
      throw new AppError(400, "You cannot change your own role");
    }

    // Demoting the last active admin locks everyone out of admin functions.
    if (target.role === "admin" && role === "customer") {
      const otherActiveAdmins = await User.countDocuments({
        role: "admin",
        isBlocked: false,
        _id: { $ne: target._id },
      });
      if (otherActiveAdmins === 0) {
        throw new AppError(400, "Cannot demote the last active admin");
      }
    }

    target.role = role;
    await target.save();

    res.json({ message: "User role updated", user: publicUser(target) });
  } catch (err) {
    next(err);
  }
}
