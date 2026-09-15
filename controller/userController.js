import User from "../models/user.js";
import Product from "../models/product.js";
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

// Shared with loginUser and updateMyProfile: firstName/lastName/image live
// in the token, so any change to them needs a freshly-signed token or the
// header greeting / checkout prefill etc. show stale data until next login.
function signToken(user) {
  return jwt.sign(
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

    res.json({
      message: "Login successful",
      token: signToken(user),
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

// --- Self-service profile (routes gated by requireAuth, always "me") ---
// No :userId param anywhere here — the target is always req.user.id from
// the verified JWT, so there is structurally no way to read or edit
// anyone else's profile through these two routes.

export async function getMyProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
}

const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;
const MAX_ADDRESS_LENGTH = 300;

export async function updateMyProfile(req, res, next) {
  try {
    const { firstName, lastName, phone, address, image } = req.body;
    // Deliberately whitelisted: email, password, role and isBlocked can
    // NEVER be changed through this endpoint, no matter what the request
    // body contains — those stay admin-only (role/isBlocked, Phase 8) or
    // need their own dedicated, more careful flow (email/password).

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (firstName !== undefined) {
      if (typeof firstName !== "string" || firstName.trim() === "") {
        throw new AppError(400, "firstName cannot be empty");
      }
      user.firstName = firstName.trim();
    }
    if (lastName !== undefined) {
      if (typeof lastName !== "string" || lastName.trim() === "") {
        throw new AppError(400, "lastName cannot be empty");
      }
      user.lastName = lastName.trim();
    }
    if (phone !== undefined) {
      if (phone !== "" && !PHONE_REGEX.test(phone)) {
        throw new AppError(400, "Invalid phone number");
      }
      user.phone = phone;
    }
    if (address !== undefined) {
      if (address.length > MAX_ADDRESS_LENGTH) {
        throw new AppError(400, `address must be ${MAX_ADDRESS_LENGTH} characters or fewer`);
      }
      user.address = address;
    }
    if (image !== undefined) {
      if (typeof image !== "string" || image.trim() === "") {
        throw new AppError(400, "Invalid image");
      }
      user.image = image;
    }

    await user.save();

    // Re-issue the token: firstName/lastName/image are embedded in it, so
    // without a fresh one the header greeting and checkout prefill would
    // keep showing the OLD values until the next login.
    res.json({
      message: "Profile updated",
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (err) {
    next(err);
  }
}

// --- Wishlist (routes gated by requireAuth, always "me") ---
// Same shape as the profile routes above: no :userId param, the wishlist
// acted on is always req.user.id's own, so there is nothing to authorize
// beyond "is this a logged-in user".

export async function getMyWishlist(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    // Resolve stored productId strings against the live catalog. A product
    // that was deleted since being wishlisted just quietly disappears from
    // the result — no error, no leftover placeholder — rather than the
    // caller ever seeing a broken entry.
    const products = await Product.find({ productId: { $in: user.wishlist } });

    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function addToWishlist(req, res, next) {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({ productId });
    if (!product) {
      throw new AppError(404, "Product not found");
    }

    // $addToSet: adding a productId already on the list is a no-op, not an
    // error — the client doesn't need to know or care whether this was
    // already wishlisted before calling this.
    await User.updateOne({ _id: req.user.id }, { $addToSet: { wishlist: productId } });

    res.json({ message: "Added to wishlist" });
  } catch (err) {
    next(err);
  }
}

export async function removeFromWishlist(req, res, next) {
  try {
    const { productId } = req.params;

    // No existence check needed: removing something not on the list (or
    // not a real product at all) is harmless and idempotent either way.
    await User.updateOne({ _id: req.user.id }, { $pull: { wishlist: productId } });

    res.json({ message: "Removed from wishlist" });
  } catch (err) {
    next(err);
  }
}
