import Product from "../models/product.js";
import { AppError } from "../utils/appError.js";
import { getRecommendation } from "../utils/geminiClient.js";

const MAX_MESSAGE_LENGTH = 500;
// Bounds how much catalog data ever gets sent to the LLM. The current
// catalog is tiny, but this keeps the prompt (and its cost) bounded
// regardless of how large the catalog grows later.
const MAX_CATALOG_SIZE = 200;

export async function getRecommendations(req, res, next) {
  try {
    const { message, budget } = req.body;

    if (typeof message !== "string" || message.trim() === "") {
      throw new AppError(400, "message is required");
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new AppError(400, `message must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }
    let budgetNumber;
    if (budget !== undefined && budget !== null && budget !== "") {
      budgetNumber = Number(budget);
      if (isNaN(budgetNumber) || budgetNumber <= 0) {
        throw new AppError(400, "budget must be a positive number");
      }
    }

    // Only ever offer products a customer could actually buy right now.
    const availableProducts = await Product.find({ isAvailable: true, stock: { $gt: 0 } })
      .limit(MAX_CATALOG_SIZE);

    if (availableProducts.length === 0) {
      return res.json({ message: "We don't have anything in stock to recommend right now.", products: [] });
    }

    const catalog = availableProducts.map((p) => ({
      productId: p.productId,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
    }));

    let recommendation;
    try {
      recommendation = await getRecommendation({
        customerRequest: message.trim(),
        budget: budgetNumber,
        catalog,
      });
    } catch (err) {
      // Never let an LLM/network failure surface as a raw 500 — the
      // concierge is a nice-to-have feature, not core checkout, so it
      // should fail with a clear, expected message instead.
      throw new AppError(502, "The AI concierge is temporarily unavailable. Please try again in a moment.");
    }

    // Defense in depth: the response schema only constrains SHAPE (an array
    // of strings), not membership. Never trust that every id the model
    // returned actually exists in the catalog we gave it — intersect
    // against the real, freshly-fetched product set instead of the summary
    // that was sent to the LLM, so price/stock in the response are always
    // current even if they drifted during the round trip.
    const availableById = new Map(availableProducts.map((p) => [p.productId, p]));
    const products = recommendation.productIds
      .filter((id) => availableById.has(id))
      .map((id) => availableById.get(id));

    res.json({ message: recommendation.message, products });
  } catch (err) {
    next(err);
  }
}
