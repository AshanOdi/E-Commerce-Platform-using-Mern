import express from "express";
import rateLimit from "express-rate-limit";
import {
  createUser,
  loginUser,
  getAllUsers,
  setUserBlocked,
  setUserRole,
  getMyProfile,
  updateMyProfile,
  getMyWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../controller/userController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const userRouter = express.Router();

// Scoped ONLY to login (not the whole API, not even registration) so a
// normal customer typing a wrong password a couple of times never notices
// this exists — it exists for someone trying hundreds of passwords fast.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

// Self-service profile (any logged-in user, always their own record)
userRouter.get("/me", requireAuth, getMyProfile);
userRouter.patch("/me", requireAuth, updateMyProfile);

// Self-service wishlist (any logged-in user, always their own list)
userRouter.get("/wishlist", requireAuth, getMyWishlist);
userRouter.post("/wishlist/:productId", requireAuth, addToWishlist);
userRouter.delete("/wishlist/:productId", requireAuth, removeFromWishlist);

// Admin: user management
userRouter.get("/", requireAdmin, getAllUsers);
userRouter.patch("/:userId/block", requireAdmin, setUserBlocked);
userRouter.patch("/:userId/role", requireAdmin, setUserRole);

// Public
userRouter.post("/", createUser);
userRouter.post("/login", loginLimiter, loginUser);

export default userRouter;
