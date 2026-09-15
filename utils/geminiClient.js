// Thin wrapper around the Gemini REST API — no SDK dependency, Node 22's
// built-in fetch is enough for a single POST. Deliberately narrow: the only
// thing this module knows how to do is "pick productIds from a given
// catalog for a given customer request," because that's the only prompt
// shape recommendController.js needs.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_INSTRUCTION = `You are a friendly beauty and style shopping concierge for an e-commerce store.
A customer will describe what they need (an occasion, a budget, a style preference).
You are given the store's REAL, CURRENT product catalog as JSON — each item has
productId, name, description, price and stock.

Rules you must always follow:
- Recommend products ONLY by choosing productId values that appear in the
  provided catalog. Never invent a productId, name, price or stock figure
  that is not already in the list.
- Respect the customer's stated budget if one is given — the sum of the
  recommended items' prices should fit within it where reasonably possible.
- If nothing in the catalog suits the request (wrong budget, no matching
  items), return an empty productIds array and explain why in "message"
  instead of forcing an unsuitable recommendation.
- Stay strictly within shopping and style recommendations. Do not give
  medical, dermatological or health/treatment advice, and do not make any
  health claims about a product, even if asked.
- Keep "message" short, friendly, and focused on why the chosen products
  fit the customer's request.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    productIds: { type: "ARRAY", items: { type: "STRING" } },
    message: { type: "STRING" },
  },
  required: ["productIds", "message"],
};

// One retry on a transient 503 (observed in practice — Gemini's flash model
// occasionally reports "currently experiencing high demand") with a short
// backoff. Anything else (4xx, network failure, a second 503) is not retried.
async function callGemini(body) {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const url = `${API_BASE}/${model}:generateContent`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === 0) continue; // network hiccup / abort — try once more
      throw new Error("Gemini request failed: " + err.name);
    }
    clearTimeout(timeout);

    if (res.status === 503 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    if (!res.ok) {
      throw new Error("Gemini API returned " + res.status);
    }
    return res.json();
  }
  throw new Error("Gemini API unavailable after retry");
}

// catalog: array of {productId, name, description, price, stock} — a plain
// summary, NOT full Mongoose docs. Returns {productIds, message}. Callers
// MUST still re-validate productIds against the real catalog before
// resolving/returning products — this function only shapes the LLM's raw
// answer, it does not vouch for it.
export async function getRecommendation({ customerRequest, budget, catalog }) {
  const userContent = JSON.stringify({
    customerRequest,
    budget: budget ?? null,
    catalog,
  });

  const data = await callGemini({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini response had no text content");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini response was not valid JSON");
  }

  if (!Array.isArray(parsed.productIds) || typeof parsed.message !== "string") {
    throw new Error("Gemini response did not match the expected shape");
  }

  return parsed;
}
