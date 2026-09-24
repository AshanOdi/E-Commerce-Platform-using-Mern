# Skincare & Beauty Shop — Backend

Express + MongoDB API for a full-featured MERN e-commerce platform: catalog, cart/checkout, orders with atomic inventory control, reviews, a mock payment gateway, wishlists, an AI shopping concierge (Google Gemini), and full admin management.

Frontend repo: [E-Commerce-Platform-using-Mern-frontend](https://github.com/AshanOdi/E-Commerce-Platform-using-Mern-frontend)

## Tech stack

- **Runtime**: Node.js, Express 5
- **Database**: MongoDB (Atlas), via Mongoose
- **Auth**: JWT (jsonwebtoken) + bcrypt password hashing — no third-party auth provider
- **AI**: Google Gemini API (`gemini-3.6-flash`), called directly via REST, no SDK
- **File storage**: Supabase Storage (used by the frontend for image uploads; the backend never touches it directly — only stores the resulting URLs)
- **Rate limiting**: express-rate-limit, scoped per-route (login, contact form, AI recommendations)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in real values, see below
npm run dev             # nodemon, auto-restarts on file changes
# or
npm start                # plain node, what production/Render runs
```

Server listens on `PORT` (default `5000`). `GET /` returns `{"status":"ok"}` once it's up.

## Environment variables

See [.env.example](.env.example) for the full list with explanations. Summary:

| Variable | Purpose |
|---|---|
| `MONGODB_URL` | MongoDB Atlas connection string |
| `JWT_KEY` | Secret used to sign/verify login tokens |
| `FRONTEND_URL` | Exact origin of the deployed frontend, used for CORS |
| `MOCKPAY_WEBHOOK_SECRET` | HMAC secret for the mock payment webhook |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Google Gemini credentials for the AI concierge |

`PORT` is set automatically by Render in production — don't set it manually there.

## Demo / test accounts

All seeded accounts share the password **`Test1234`**:

| Email | Role |
|---|---|
| `ashan@gmail.com` | admin |
| `akasha@gmail.com` | customer |
| `ashan1@gmail.com` | customer |
| `disna@gmail.com` | customer |

## API reference

All routes are prefixed with `/api`. Routes marked 🔒 require a valid JWT (`Authorization: Bearer <token>`); 🔒admin requires an admin-role account.

**User & auth** (`/api/user`)
| Method | Path | Description |
|---|---|---|
| POST | `/` | Register (always creates a `customer`) |
| POST | `/login` | Login, returns a JWT (rate-limited) |
| GET | `/me` 🔒 | Get your own profile |
| PATCH | `/me` 🔒 | Update your own name/phone/address/photo |
| GET | `/wishlist` 🔒 | Get your wishlist (resolved to full products) |
| POST | `/wishlist/:productId` 🔒 | Add a product to your wishlist |
| DELETE | `/wishlist/:productId` 🔒 | Remove a product from your wishlist |
| GET | `/` 🔒admin | List all users |
| PATCH | `/:userId/block` 🔒admin | Block/unblock a user |
| PATCH | `/:userId/role` 🔒admin | Change a user's role |

**Products** (`/api/product`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List products (search, price range, sort, pagination) |
| GET | `/:productId` | Get one product |
| POST | `/` 🔒admin | Create a product |
| PUT | `/:productId` 🔒admin | Update a product |
| DELETE | `/:productId` 🔒admin | Delete a product |

**Orders** (`/api/order`)
| Method | Path | Description |
|---|---|---|
| POST | `/` 🔒 | Place an order (atomic stock check-and-decrement) |
| GET | `/` 🔒 | Your own order history |
| GET | `/:orderId` 🔒 | One of your own orders |
| GET | `/all` 🔒admin | All orders |
| GET | `/all/:orderId` 🔒admin | Any order by ID |
| PATCH | `/:orderId/status` 🔒admin | Move an order through its status lifecycle |

**Reviews** (`/api/review`)
| Method | Path | Description |
|---|---|---|
| GET | `/:productId` | A product's reviews |
| POST | `/` 🔒 | Leave a review (one per product per user) |
| PATCH | `/:reviewId` 🔒 | Edit your own review |
| DELETE | `/:reviewId` 🔒 | Delete your own review |

**Payment** (`/api/payment`) — mock gateway
| Method | Path | Description |
|---|---|---|
| POST | `/intent` 🔒 | Start payment for an order |
| GET | `/intent/:intentId/status` 🔒 | Poll payment status |
| POST | `/mock/charge` 🔒 | Simulate a successful/failed charge |
| POST | `/webhook` | HMAC-signed webhook that finalizes payment status |

**Contact** (`/api/contact`)
| Method | Path | Description |
|---|---|---|
| POST | `/` | Submit the contact form (rate-limited) |

**AI Concierge** (`/api/recommend`)
| Method | Path | Description |
|---|---|---|
| POST | `/` | `{message, budget?}` → real, catalog-grounded product recommendations (rate-limited) |

## Architecture notes

- **Auth**: stateless JWT, 1-day expiry. The token embeds `id/email/firstName/lastName/role/image`; it's re-issued whenever any of those fields change (e.g. profile update) so the client never shows stale data.
- **Inventory**: stock decrements are atomic (`findOneAndUpdate` with a stock-sufficiency filter), so concurrent orders can never oversell the last unit.
- **AI concierge**: the LLM only ever sees a plain-text summary of the *currently in-stock* catalog and returns product IDs via a strict JSON schema; the backend re-validates every returned ID against the real catalog before resolving it to a document, so a hallucinated or stale ID can never reach the customer.
- **Payments**: this is a mock gateway (`paymentintents` collection) for demo purposes — no real payment processor is integrated.

## Known limitations

- Image uploads (product photos, profile photos) depend on Supabase Storage, configured in the frontend's `mediaUpload.jsx` — if that project isn't set up, uploads/existing images will fail.
- No automated test suite yet (planned).
- No real payment processor — the payment flow is a fully-functional mock for demonstrating the checkout/payment architecture.

## Deployment

Backend deploys to **Render** as a Node web service (`npm start`). See [.env.example](.env.example) for required environment variables.
