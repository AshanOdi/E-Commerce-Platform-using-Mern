import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import studentRouter from "./routers/studentRouter.js";
import userRouter from "./routers/userRoute.js";
import productRouter from "./routers/productRoutes.js";
import orderRouter from "./routers/orderRouter.js";
import reviewRouter from "./routers/reviewRouter.js";
import paymentRouter from "./routers/paymentRouter.js";
import contactRouter from "./routers/contactRouter.js";
import { authenticateUser } from "./middleware/authMiddleware.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();

// CORS: allow only the configured frontend origin. Falls back to the local
// Vite dev server so nothing breaks in development; set FRONTEND_URL in
// .env once there's a real deployed frontend domain.
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: allowedOrigin }));

// Express 5 has built-in JSON body parsing — no need for the separate
// body-parser package. The `verify` hook stashes the raw bytes so the
// payment webhook can HMAC-verify the exact payload the provider signed.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Authentication runs globally: decodes the token if one is present and
// attaches req.user, but never blocks an anonymous request by itself.
app.use(authenticateUser);

app.use("/api/student", studentRouter);
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/order", orderRouter);
app.use("/api/review", reviewRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/contact", contactRouter);

// Any request that didn't match a route above -> a clean JSON 404 instead
// of Express's default HTML error page.
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Must be registered LAST — this is what every controller's next(err) lands in.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to the database FIRST. Only start accepting HTTP traffic once
// that succeeds. If it fails, exit immediately with a non-zero code instead
// of running in a broken, half-alive state.
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("Connected to database");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    // Never log err.message/err directly here — some Mongoose driver errors
    // can echo back parts of the connection string. err.name is safe.
    console.error("Failed to connect to the database (" + err.name + "). Startup aborted.");
    process.exit(1);
  });
