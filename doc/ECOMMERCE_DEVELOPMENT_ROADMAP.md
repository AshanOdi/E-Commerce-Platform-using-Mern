# MERN E-Commerce Platform — Development Roadmap & Learning Log

## Purpose

This is the **Single Source of Truth (SSOT)** for completing the MERN e-commerce application before AWS.

The project is being built with AI assistance, but every phase must remain understandable.

### Rules

1. One response = one logical phase/feature.
2. Inspect existing code before changing anything.
3. Explain the design before implementation.
4. Implement only the current phase.
5. Run real tests; never claim unrun tests passed.
6. Explain what was learned.
7. Give interview questions for important technical phases.
8. Commit at the end of a successful phase, with the exact commit message shown in the response (as of Response #06, done automatically per the developer's instruction — previously manual).
9. No `Co-Authored-By` / AI-attribution line in commit messages for this project.
10. Developer still reviews the diff before the next phase begins.
11. Keep Response Number ↔ Git Commit traceability.
12. Stop after the assigned phase.

---

# CURRENT STATUS

## Stack

Frontend: React 19, Vite, Tailwind v4, React Router, Axios, Context API, Supabase Storage.

Backend: Node.js, Express 5, Mongoose, MongoDB Atlas, JWT, bcrypt, express-rate-limit.

Current architecture:

```text
Browser
  ↓
React/Vite
  ↓ REST/Axios
Express API
  ↓ JWT/Auth
MongoDB Atlas

Product images → Supabase Storage
```

AWS has NOT started.

---

# COMPLETED PHASES

## Response #01 — Phase 0: Security/Foundation

Completed:

- environment-based secrets
- configurable PORT
- restrictive CORS
- JWT authentication and expiry
- requireAuth / requireAdmin
- fixed req.User → req.user
- centralized error handling
- AppError
- 404 handling
- login rate limiting
- basic validation
- DB fail-fast behavior
- image upload validation
- removed body-parser usage

Important manual action still required:

- Rotate the previously exposed MongoDB Atlas password.

Commit:

```text
fix(security): harden backend foundation
```

---

## Response #02 — Phase 0 Final Browser Verification

Completed:

- reproduced and diagnosed localhost vs 127.0.0.1 CORS mismatch
- verified localhost browser flow
- verified Phase 0 security behavior
- no code changes

Commit:

```text
NO COMMIT — verification only
```

---

## Response #03 — Phase 1: Product Detail Page

Completed:

- `/product/:productId`
- ProductDetailPage
- useParams()
- backend product fetch
- loading/error/not-found states
- image gallery
- quantity selector
- clickable ProductCard
- stopPropagation for Add to Cart

Commit:

```text
feat(product): add product detail page
```

---

## Response #04 — Phase 2: Shopping Cart

Status: PASS

Completed:

- CartContext
- CartProvider
- useCart()
- addToCart
- removeFromCart
- updateQuantity
- clearCart
- derived cartItemCount
- derived cartTotal
- localStorage persistence
- corrupted localStorage recovery
- `/cart`
- header cart badge
- ProductCard Add to Cart
- ProductDetail Add to Cart
- duplicate-item merging
- quantity clamping

Cart item:

```text
productId
name
image
price
labelledPrice
quantity
stock
```

Important boundary:
The frontend cart is only customer intent. Price, stock, availability and final order total must be revalidated by the backend.

Commit:

```text
feat(cart): implement persistent shopping cart
```

---

## Response #05 — Phase 3: Checkout

Status: PASS

Completed:
- `/checkout`
- delivery form (name/email/phone/address), name+email prefilled from the
  JWT payload (base64url-decoded client-side, display only — never
  trusted as auth)
- login guard (redirects to `/login` if no token)
- empty-cart guard
- order summary (display only, from CartContext)
- submits `{name, address, phone, products:[{productId, Qty}]}` to the
  existing `POST /api/order` — no price/total ever sent
- loading / error / success states
- order confirmation (real orderId + real backend-computed total)
- clears cart on success
- CartPage's "Proceed to Checkout" now navigates to `/checkout`

Verified client vs. server authority directly: a forged `curl` request
with `total: 0.01` / `price: 0.01` was completely ignored — the created
order stored the real DB price. The backend's existing `createOrder`
was not modified.

Bug found and fixed during testing: JWT payload decode used plain
`atob()`, but JWTs are base64**url** (`-`/`_`, no padding) — this
silently failed on real tokens and blanked the name/email prefill,
which cascaded into client-side validation blocking submission. Fixed
by converting base64url → base64 (with padding) before decoding.

Commit:

```text
feat(checkout): implement customer checkout flow
```

---

## Response #06 — Phase 4: Inventory & Atomic Stock

Status: PASS

Completed:
- `createOrder` now checks stock via one atomic operation:
  `Product.findOneAndUpdate({productId, isAvailable:true, stock:{$gte:Qty}}, {$inc:{stock:-Qty}})`
  — the availability/sufficiency check and the decrement happen as a
  single indivisible write, closing the check-then-act race window.
- Multi-item rollback: if any item in an order fails (insufficient
  stock, not found, unavailable, or the final `Order.save()` itself),
  every item already decremented in that same order attempt is
  compensated back (`$inc` positive) before the error is returned.
- New `409 Conflict` status specifically for "insufficient stock",
  distinct from `400` (bad input / unavailable) and `404` (not found).
- Order-ID generation moved to AFTER stock is secured, so the loser of
  a stock race never reaches order-ID allocation.

Verified live, not just by inspection — fired two truly concurrent
`POST /api/order` requests at a product with `stock=1`:

```text
Order A: SUCCESS (201)
Order B: FAILED (409) — "Only 0 unit(s) ... left in stock"
Final stock: 0
```

Also verified: multi-item order where item 2 is insufficient rolls
item 1's decrement back to its original value; normal single/multi-item
orders still decrement correctly; 404/400/409 remain distinct; full
browser cart→checkout→order flow (Phase 3) still passes unchanged.

Found but NOT fixed (separate, pre-existing, out of scope for this
phase): the order-ID generator itself has its own race — two
concurrent orders for *different*, both-in-stock products could still
collide on the "next" order number. Candidate for a future hardening
pass (e.g. a dedicated atomic counter document) — not an inventory/
overselling issue, so deliberately deferred.

Commit:

```text
fix(inventory): prevent overselling with atomic stock updates
```

---

## Response #07 — Phase 5: Customer Order History

Status: PASS

Completed:
- `Order.userId` (ObjectId ref "users") added — a proper REFERENCE for
  ownership, alongside the pre-existing `products[].productInfo`
  SNAPSHOT (what was actually bought, frozen at purchase time). Same
  document, two different relationship types for two different reasons.
- JWT payload now carries `id: user._id` (added at login) so order
  endpoints can scope by ownership without an extra DB lookup per
  request.
- Backend: `GET /api/order` (own orders only), `GET /api/order/:orderId`
  (own order only — a real order belonging to someone else returns the
  same 404 as a nonexistent one, never 403, so existence isn't leaked).
- `createOrder` now sets `userId` and gives a clear 401 ("please log in
  again") if a token predates this change, instead of a confusing
  generic validation error.
- Frontend: `/my-orders` (list), `/my-orders/:orderId` (detail), a
  static "My Orders" header link, and a "View order" link on the
  checkout success screen straight to the new order.

Verified live: two separate customers — B gets 404 on A's order by ID,
B's own list shows 0 (not A's orders), A still sees their own order
and list correctly. Also verified the JWT-migration edge case directly
(an old-shape token without `id` on both GET and POST /api/order) and
found/fixed a rough edge where POST fell through to a generic 400
instead of a clear 401.

Commit:

```text
feat(orders): add customer order history
```

---

## Response #08 — Phase 6: Authentication UX Completion

Status: PASS

Completed:
- `AuthContext`/`AuthProvider` (Context+useState, same pattern as
  CartContext) — decodes the JWT once at startup, exposes `user`,
  `isAuthenticated`, `isAdmin`, `login()`, `logout()`. Placed INSIDE
  `BrowserRouter` (unlike `CartProvider`, which wraps it) because it
  needs `useNavigate()` for logout/expired-session redirects.
- `utils/jwt.js` — shared `decodeTokenPayload`/`isTokenExpired`,
  extracted out of `checkoutPage.jsx`'s local copy.
- `RequireAuth`/`RequireAdmin` route-guard components — replace the
  copy-pasted per-page "check token in a useEffect" guards in
  checkoutPage/myOrdersPage/orderDetailPage, and for the first time
  actually protect `/admin/*` (previously wide open client-side).
- Global expired-session handling: one `axios` response interceptor in
  `AuthProvider`, keyed on "did THIS failed request carry an
  Authorization header" (not "is there a token in storage") so a
  wrong-password login attempt is never mistaken for a dead session.
- Logout, auth-aware header (Login vs. "Hi, {name}" + Logout +
  My Orders), role-based redirect on login (pre-existing, preserved).

Two real bugs found and fixed via testing, not assumed:
1. `logout()`'s own `navigate("/")` raced against `RequireAuth`'s
   reactive `<Navigate>` (both triggered by the same `setUser(null)`),
   producing a wrong final URL and a React "setState during another
   component's render" warning. Fixed by moving the guards' redirect
   logic into a `useEffect` (post-commit) instead of returning
   `<Navigate>` synchronously during render, and removing the
   redundant explicit navigate from `logout()` entirely.
2. `login.jsx` silently `console.log`'d failed-login errors with zero
   user feedback — fixed to `toast.error(...)` while already touching
   this function for the `AuthContext` integration.

Commit:

```text
feat(auth): complete authentication and protected routes
```

---

## Response #09 — Phase 7: Admin Order Management

Status: PASS

Completed:
- Backend, all `requireAdmin`:
  - `GET /api/order/all` — every order, newest first
  - `GET /api/order/all/:orderId` — any single order (no userId scoping,
    unlike the customer endpoint)
  - `PATCH /api/order/:orderId/status` — status change validated against
    a state machine:
    `pending → confirmed|cancelled`, `confirmed → processing|cancelled`,
    `processing → shipped|cancelled`, `shipped → delivered`,
    `delivered`/`cancelled` terminal. Any skip / backward / terminal
    transition → 400.
  - `/all` routes registered BEFORE `/:orderId` so the literal path
    isn't captured as a param.
  - Cancelling an order restocks its items (atomic `$inc`, same pattern
    as Phase 4's failed-order compensation). "cancelled" is terminal →
    no double-restock possible.
- Frontend: `/admin/orders` list (id / customer / date / total / status
  badge) and `/admin/orders/:orderId` detail with status buttons that
  show only the valid next transitions (frontend mirrors the state
  machine for UX; backend still enforces). Replaces the
  `<h1>ORDER PAGE</h1>` placeholder. Also fixed the `ODERS` → `ORDERS`
  sidebar typo.

Verified live: full state-machine matrix via curl (invalid value, skip,
backward-from-terminal, already-X, each valid forward step) + cancel
restocking exactly the ordered quantity (stock 47 → 42 on a 5-unit
order → 47 after cancel) + terminal cancelled rejecting further
changes. Access control confirmed (customer → 403 on every admin
endpoint), customer's own order endpoints unaffected by the new route
ordering, and the admin UI E2E (list, detail, status buttons updating
and re-deriving the next options, non-admin redirected off
`/admin/orders`). Zero console errors.

Commit:

```text
feat(admin): add order management
```

---

## Response #10 — Phase 8: User Management

Status: PASS

Completed:
- Backend, admin (requireAdmin): `GET /api/user` (all users, password
  excluded, sorted role then email); `PATCH /api/user/:userId/block`
  ({isBlocked}); `PATCH /api/user/:userId/role` ({role}).
- `loginUser` now rejects `isBlocked` users with 403 (checked AFTER the
  password so a blocked account isn't revealed to someone without the
  right credentials). `isBlocked` already existed on the schema — it
  was just never enforced.
- Admin-creation logic fixed: `createUser` (public `POST /api/user`) no
  longer reads `role` from the body at all — public registration
  always creates a customer, full stop. Promotion is admin-only via
  the new role endpoint; the first admin is seeded in the DB.
- Administrative safety: an admin cannot block or demote their own
  account (400), and blocking/demoting an admin is rejected (400) when
  it would leave zero active admins
  (`countDocuments({role:"admin", isBlocked:false, _id:{$ne:target}})`
  === 0). This also backstops the known stale-token window — a
  just-demoted admin's still-valid token can't use itself to remove
  the last remaining admin.
- Frontend: `/admin/users` list (email / name / role badge / status
  badge / inline Make admin↔Make customer + Block↔Unblock). The
  admin's own row is marked "(you)" with no action buttons.
  Backend rejections surface as toasts. Replaced `<h1>USER PAGE</h1>`.
- Known limitation (unchanged from Phase 0/6, documented not fixed):
  blocking stops NEW logins; an already-issued token stays valid until
  it expires (≤24h) — no server-side session revocation.

Verified live via curl with an isolated scenario (real `ashan` admin
temporarily demoted so the last-admin guard was reachable with test
admins only, restored after): list access control (admin 200 /
customer 403 / anon 401, no password field), both self-guards, all
input-validation branches (bad role value, non-boolean isBlocked,
missing user 404, malformed id 400), promote/demote round-trip,
last-admin guard hit via a stale admin token on both role and block
(400 each), blocked-user login 403 then 200 after unblock, and
`POST /api/user {role:"admin"}` being silently created as a customer.
Frontend E2E: users list, own-row locked, promote/demote and
block/unblock round-trips reflected in the badges, non-admin bounced
off `/admin/users`. Zero console errors. All test users deleted and
`ashan` + real accounts restored to their known-good state.

Commit:

```text
feat(admin): add user management
```

---

## Response #11 — Phase 9: Search, Filtering & Pagination

Status: PASS

Completed:
- `getProduct` rewritten: accepts `search`, `minPrice`, `maxPrice`,
  `sort` (`price_asc|price_desc|name_asc|name_desc`, default
  `name_asc`), `page` (default 1), `limit` (default 12, hard cap 50).
  Response shape changed from a bare array to
  `{ products: [...], pagination: { page, limit, total, totalPages } }`.
- Search: case-insensitive PARTIAL match (regex) on `name` + `altNames`,
  metacharacters escaped (no ReDoS), `typeof === "string"` guarded
  (Express's default query parser turns `?search[$ne]=x` into an
  object). `sort` is whitelist-only so an injected object falls back
  to the default. `page`/`limit` clamped. Customers still never see
  `isAvailable: false`.
- Category filtering was NOT built — the Product model has no category
  field and there is no category data; adding one is a data-modeling
  change out of scope here.
- Index: added compound `{ isAvailable: 1, price: 1 }` to the schema —
  the customer query is exactly
  `find({isAvailable:true, price:{$gte,$lte}}).sort({price})`, so one
  index serves the equality filter + range + sort. `explain()`
  confirmed `IXSCAN` (not `COLLSCAN`). The regex search is
  deliberately un-indexed (partial-match UX beats a whole-word text
  index at this catalog size; text index / Atlas Search is the
  large-catalog answer).
- Frontend `client/productPage.jsx` rewritten: search box (debounced
  400ms), min/max price inputs, sort select, Prev/Next pagination with
  "Page X of Y · N products", loading / empty / error states, and a
  "Clear filters" button. All filter/sort/page state lives in the URL
  via `useSearchParams` — the listing is shareable and back-button
  friendly (same "URL is the source of truth" principle as Phase 1).
- `admin/productPage.jsx` updated for the new response shape:
  `?limit=200`, reads `res.data.products`.

Bug found and fixed during testing: the debounced-search effect
captured a stale `searchParams` snapshot, so ~400ms after "Clear
filters" its timer rewrote the URL from the pre-clear params (sort +
minPrice reappeared). Fixed by switching `updateParams` to
`setSearchParams`'s functional updater (always merges into current
params) and adding `currentSearch` to the debounce effect's deps so
its guard uses fresh values.

Verified via curl: response shape; pagination (17 available products,
page 1 = 12 / page 2 = 5 / page 99 = 0, `limit=999` clamped to 50,
`page=-3&limit=0` -> 1/12); partial case-insensitive search including
an altNames hit and a regex-metachar query (200, not 500); price
range (both bounds, min-only, max-only); every sort direction + an
injected sort object (falls back, no crash); an unavailable product
never returned to an anonymous client; a combined
search+minPrice+sort query. Frontend E2E: initial load, Next/Previous,
debounced search, sort, price filter, empty state, Clear filters (now
fully clears), a directly-loaded `?search=oil` URL pre-filling the box,
and regressions on card->detail navigation and the admin product
table still loading. Zero console errors. Seed products removed;
real catalog intact.

Commit:

```text
feat(product): add search filtering and pagination
```

---

## Response #12 — Phase 10: Reviews & Ratings

Status: PASS

Completed:
- New `models/review.js`: `{ productId (String), userId (ObjectId ref
  users), userName (snapshot), rating (1-5), comment (<=1000),
  isVerifiedPurchase, date }`. Two indexes: `{productId, userId}`
  UNIQUE (one review per user per product, DB-enforced) and
  `{productId, date:-1}` (product reviews newest-first).
  Reference vs snapshot again: `userId` is a relationship, `userName`
  is frozen at review time (byline without a join).
- New `controller/reviewController.js` + `routers/reviewRouter.js`,
  mounted at `/api/review`:
  * `GET /api/review/:productId` — public. Returns
    `{ reviews (newest first), summary: { average, count,
    distribution } }`. The summary comes from ONE aggregation
    (`$match` + `$group` by rating), reduced to avg/count/dist in JS.
  * `POST /api/review` — requireAuth. `{ productId, rating, comment }`.
    Validates rating is a whole 1-5 and comment is 1-1000 chars,
    checks the product exists (404), snapshots `userName` from the
    JWT, and sets `isVerifiedPurchase` from
    `Order.exists({ userId, "products.productInfo.productId":
    productId })`. A duplicate (unique-index E11000) is caught and
    returned as 409 "You have already reviewed this product".
  * `PATCH /api/review/:reviewId` — requireAuth, owner only
    (`findOne({_id, userId})` -> 404 for anyone else's, never 403).
  * `DELETE /api/review/:reviewId` — requireAuth, owner only.
- Frontend: new `src/components/productReviews.jsx` (rating summary
  with a 1-5 distribution, reviews list with Verified Purchase badge,
  a star-picker + textarea form shown only to a logged-in user who
  has not reviewed yet, inline edit, delete, and a "log in to review"
  prompt for anonymous visitors). Wired into `productDetailPage.jsx`
  as a full-width section below the product (the return was wrapped so
  the image/detail row and the reviews section stack).
- Not done (noted): admin review moderation (delete any review) —
  owner-only this phase; ratings on the product cards / listing —
  would want a denormalised `averageRating` on Product to avoid N+1,
  deferred.

Verified via curl (real users disna + akasha, product P001): empty
summary shape; create + duplicate 409 + second user; aggregation
(avg 4, count 2, distribution {3:1,5:1}, newest-first order); every
validation branch (rating 0/6/3.5, empty/1001-char comment, missing
productId 400, unknown productId 404, unauthenticated 401);
owner-only edit (200 for owner, 404 for another user, 400 for a
malformed id) and delete; `isVerifiedPurchase: true` after inserting
an order containing P001; both indexes present with the unique flag.
Frontend E2E: anonymous prompt + no form; a logged-in user posts
(star-picker + comment), sees it listed with Edit/Delete and the form
gone; edit updates the text; a second user sees the first review
without Edit/Delete and gets their own form; the summary count
tracks; delete restores the form. Zero console errors. All test
reviews removed afterward.

Commit:

```text
feat(reviews): add product reviews and ratings
```

---

## Response #13 — Phase 11: Payment

Status: PASS

Choice made: **mock gateway** (developer's pick) — the full secure
architecture of a real integration, with a local "provider" instead
of Stripe, so it stays runnable with no external accounts. Real seams
(intent -> hosted pay page -> provider webhook -> verify -> mark paid)
are all present for a real gateway to slot into later.

Backend:
- `models/paymentIntent.js` (new): `{ intentId (unique), orderId,
  userId, amount, currency, status: requires_payment | processing |
  succeeded | failed, date }`. `amount` is set server-side from the
  order total. Index on `orderId`.
- `models/order.js`: added `paymentStatus` (`unpaid | paid | failed`,
  default `unpaid`) — payment lifecycle tracked separately from the
  Phase 7 `status` fulfilment lifecycle.
- `index.js`: `express.json({ verify })` now stashes `req.rawBody` so
  the webhook can HMAC-verify the exact signed bytes; mounts
  `/api/payment`.
- `controller/paymentController.js` + `routers/paymentRouter.js`:
  * `POST /api/payment/intent { orderId }` (requireAuth) — order
    must be the caller's and not already paid; creates (or reuses a
    still-payable) intent; returns `{ intentId, amount, currency }`.
  * `GET /api/payment/intent/:intentId/status` (requireAuth, owner
    only) — the pay page polls this.
  * `POST /api/payment/mock/charge { intentId, outcome }` (requireAuth,
    owner only) — simulates paying on the provider's page: marks the
    intent `processing`, builds a `payment.succeeded|failed` event,
    HMAC-signs it, and delivers it server-to-server to our own
    `/api/payment/webhook` — a real HTTP round-trip through the real
    handler.
  * `POST /api/payment/webhook` (NO auth middleware) — authenticated
    by signature: recompute HMAC-SHA256 over `req.rawBody` with
    `MOCKPAY_WEBHOOK_SECRET`, `timingSafeEqual` compare, 401 on
    mismatch/missing. Idempotent: a repeated event for an intent
    already in a terminal state is a 200 no-op. On success -> intent
    `succeeded`, order `paymentStatus: paid` and (if `pending`)
    `status: confirmed`. On failure -> intent `failed`, order
    `paymentStatus: failed`, `status: cancelled`, and the reserved
    stock is returned with the same atomic `$inc` used by a Phase 7
    admin cancellation.
- New env var `MOCKPAY_WEBHOOK_SECRET`.

Frontend:
- `checkoutPage.jsx`: after `POST /api/order` it now creates a
  payment intent and `navigate("/pay/:intentId")` instead of showing
  an "Order placed" screen. If intent creation fails it toasts and
  routes to the order detail. Button label -> "Continue to Payment".
- `payPage.jsx` (new, route `/pay/:intentId`, RequireAuth): shows the
  server-computed amount + "no card details collected or stored",
  a "Pay Now" and a "Simulate a failed payment" button, then polls
  the intent status once/second to the terminal screen
  ("Payment successful" with a link to the order / "Payment failed —
  order cancelled and items returned to stock"). Revisiting a
  finished intent shows its terminal state, not the buttons.
- Customer + admin order-detail pages: a payment badge
  (Paid / Unpaid / Payment failed) next to the fulfilment badge.

Boundary demonstrated: the order is marked paid ONLY by the
signature-verified webhook, never by the browser. The pay page's
success screen is cosmetic — the backend already knew.

Verified via curl (with the real webhook secret read from .env):
- Intent amount === order.total; second `POST /intent` returns the
  same intent; intent for a missing order -> 404; for an already-paid
  order -> 400.
- Webhook with a bad signature -> 401 "Invalid signature"; with no
  signature -> 401.
- Happy path: mock charge -> webhook -> intent `succeeded`, order
  `paid` / `confirmed`.
- Idempotency: replaying the signed `payment.succeeded` -> 200
  "already processed", order unchanged; charging an already-succeeded
  intent -> 409.
- Failure path: mock charge (failure) -> intent `failed`, order
  `failed` / `cancelled`, P001 stock 113 -> 116 (restored).
- Ownership: another user can neither read nor charge someone else's
  intent (404).
- Regression: product / review / order / user / admin endpoints all
  200, expired-JWT -> 401.
Frontend E2E (real browser): success flow checkout -> /pay ->
Pay Now -> "Payment successful" -> order detail shows "Paid" +
"confirmed"; failure flow -> "Simulate a failed payment" ->
"Payment failed ... returned to stock". Zero console errors. All test
orders / intents deleted and P001 stock restored to 118 afterward.

Commit:

```text
feat(payment): integrate secure payment flow
```

---

## Response #14 — Phase 12: Professional Customer Pages

Status: PASS

Built real Home / About / Contact pages, replacing the `<h1>` stub
routes in `home.jsx`.

Deliberate scope decisions:
- **Contact intentionally lists no phone/address/email.** The
  roadmap's own instruction was "only real/approved business contact
  information" — none was supplied, so rather than inventing a
  plausible-looking fake one, Contact is a genuinely **working form**
  backed by a real endpoint that stores submissions. No fabricated
  facts anywhere on the page.
- **Home skips "categories"** — no `category` field/data on `Product`
  (same call made in Phase 9's search work).
- **"On Sale" is derived, not fabricated** — filtered client-side from
  the same featured-products fetch (`labelledPrice > price`), no new
  backend query.
- **AI Concierge teaser is explicitly labelled "Coming soon"** and
  links nowhere — Phase 15 doesn't exist yet, so nothing overpromises
  a feature that isn't live.
- **About's copy is generic brand-values language** — no invented
  founding dates, names, or claims.

Backend (new, minimal — only what Contact needed):
- `models/contactMessage.js`: `{ name, email, subject, message, date
  }`.
- `controller/contactController.js` + `routers/contactRouter.js`,
  mounted at `POST /api/contact` (public): validates all fields
  present, email format, message ≤2000 chars; rate-limited to 5 per
  15 min per IP (same `express-rate-limit` pattern as Phase 0's login
  limiter — a public unauthenticated form is a spam target).

Frontend (`src/pages/client/`):
- `landingPage.jsx` (`/`): hero + "Shop Now" CTA, Featured Products
  (live `GET /api/product?limit=8&sort=name_asc`, reuses
  `ProductCard`), On Sale (derived subset), a 3-point value-prop strip
  (semantic `<section>`/`sr-only` heading), AI Concierge teaser.
- `aboutPage.jsx` (`/about`): three `<section>`s (mission, how
  products are chosen, review-trust policy) each with a proper
  `id`-linked `<h2>`.
- `contactPage.jsx` (`/contact`): a real form (name/email/subject/
  message) with associated `<label>`s, client-side required-field
  validation, POSTs to `/api/contact`, loading/success/error states.
- Accessibility/semantic-HTML pass on all three: one `<h1>` per page,
  `<main>`/`<section>` landmarks, `aria-labelledby` tying headings to
  their sections, labels properly associated with inputs.

Verified: backend contact validation (missing fields → 400, bad email
→ 400) and the rate limiter (6th rapid submission → 429, 5 allowed).
Frontend E2E (real browser): hero/CTA/featured-products/value-props/
AI-teaser all present and correct; "Shop Now" → `/product`; About
renders its 3 sections; Contact's empty-submit shows inline
validation, a real submission reaches the backend and shows "Message
sent", and the page was explicitly checked to contain **no**
fabricated phone/address text. Confirmed via direct DOM measurement
that an apparently-truncated "On Sale" card in one screenshot was a
`fullPage` screenshot-timing artifact, not a real rendering bug (its
bounding box matched every other card exactly). Zero new console
errors (the only console entries are the pre-existing, unrelated
broken `example.com` sample-image URLs seen since Phase 1).

Commit:

```text
feat(ui): build professional customer pages
```

---

## Response #15 — Phase 13: Customer Profile

Status: PASS

Backend:
- `models/user.js`: added `phone` and `address` (both optional strings)
  — didn't exist before this phase.
- `controller/userController.js`: extracted a shared `signToken(user)`
  helper (used by both `loginUser` and the new update, deduplicating
  the payload shape). New `getMyProfile` / `updateMyProfile`, mounted
  at `GET/PATCH /api/user/me` (`requireAuth`). Neither route takes a
  `:userId` param — the target is always `req.user.id` from the
  verified JWT, so there is structurally no way to read or edit
  anyone else's profile through them (no ownership check needed
  because there's nothing to check against). `updateMyProfile`
  whitelists exactly `{firstName, lastName, phone, address, image}`
  from the body — `email`, `password`, `role`, `isBlocked` are never
  read from it, no matter what's sent (verified: a request smuggling
  `role:"admin"` etc. is silently ignored). On success it **reissues
  a fresh JWT** — `firstName`/`lastName`/`image` live in the token
  payload (Phase 5/6), so without a new token the header greeting and
  checkout's name-prefill would keep showing stale data until the
  next login.
- Validation: name fields non-empty if provided; phone matches a
  loose `[0-9+\-\s()]{7,20}` pattern; address capped at 300 chars;
  image must be a non-empty string.

Frontend:
- `src/pages/client/profilePage.jsx` (new, route `/profile`,
  `RequireAuth`): fetches `GET /api/user/me` on mount, editable
  first/last name, phone, address, and a profile-photo file input
  that reuses the EXISTING `mediaUpload.jsx` Supabase helper (the
  same one admin product images already use — no new upload code).
  Email and role are shown read-only. On save, `PATCH /api/user/me`
  then `useAuth().login(newToken)` to refresh `AuthContext`
  immediately — no re-login required to see the new name/photo
  anywhere in the app.
- `header.jsx`: the "Hi, {name}" greeting is now a `<Link to="/profile">`
  — the only way to reach the page, so this was a necessary touch,
  not incidental redesign.

Verified via curl: `GET/PATCH /me` round-trip; every validation
branch (empty name, bad phone, over-length address) → 400; **the
privilege-escalation attempt** — `PATCH /me` with
`{role:"admin", isBlocked:true, email:"hacked@..."}` — confirmed
completely ignored (response still shows the real role/isBlocked/
email); both routes 401 when unauthenticated. Frontend E2E (real
browser, label-based selectors after an early test-script indexing
mistake was caught and corrected): prefill correct for every field;
client-side empty-name validation blocks submission; a real update
(name/phone/address/photo, the photo via a real Supabase upload)
saves and the header updates to the new name **live, with no
re-login**; a page reload re-fetches from the server and confirms
every field persisted; and — the key cross-cutting proof — revisiting
Checkout afterward shows the **new** name in its prefill, confirming
the token refresh propagates everywhere the JWT is decoded, not just
the header. Zero new console errors. Test user and its profile-photo
upload cleaned up (the tiny test image in Supabase Storage could not
be deleted via the anon key — noted, low-impact, one leftover file).

Commit:

```text
feat(profile): add customer profile management
```

---

## Response #16 — Phase 14: Wishlist & Shopping Enhancements

Status: PASS

Scope decision: the roadmap listed an "optional coupon foundation"
for this phase. Deferred it entirely — no Coupon model, no
`/api/coupon` route exists anywhere yet — to keep the phase focused
on its two non-optional items (wishlist, unavailable-product
handling), per the developer's explicit choice when asked.

Backend:
- `models/user.js`: added `wishlist` (array of `productId` strings,
  default `[]`) — plain strings, not refs to Product `_id`, matching
  how order line items and the cart already identify products by
  `productId` elsewhere in this app.
- `controller/userController.js`: three new self-scoped functions,
  same pattern as Phase 13's `/me` routes — no `:userId` param
  anywhere, the wishlist acted on is always `req.user.id`'s own.
  `getMyWishlist` resolves the stored productId strings against the
  live `Product` collection and returns full docs (a deleted
  product's id just silently disappears from the result — no error,
  no broken placeholder). `addToWishlist` (`$addToSet`, 404s if the
  productId doesn't exist) and `removeFromWishlist` (`$pull`, always
  succeeds — removing something not on the list is harmless) are
  both fully idempotent.
- `routers/userRoute.js`: `GET /api/user/wishlist`,
  `POST/DELETE /api/user/wishlist/:productId` (all `requireAuth`).

Frontend — Wishlist:
- `src/context/WishlistContext.jsx` (new): server-backed, unlike
  `CartContext` — nothing is persisted to `localStorage`, since a
  guest has nothing to keep (the heart toggle just asks them to log
  in). Re-syncs whenever `isAuthenticated` changes, so logging out
  clears it and logging in as a different user fetches THAT user's
  wishlist, never a stale previous one. `toggleWishlist` updates
  optimistically (the heart flips instantly) and reverts if the
  request fails.
- `src/pages/client/wishlistPage.jsx` (new, route `/wishlist`,
  `RequireAuth`): lists full product docs with Add-to-Cart and
  Remove; an item whose product has since become unavailable is shown
  greyed-out with "No longer available" and a disabled Add-to-Cart
  button, rather than just vanishing or crashing.
- Heart toggle (`react-icons` `FaHeart`/`FaRegHeart`) added to both
  `productCard.jsx` and `productDetailPage.jsx`; clicking it while
  logged out shows a toast asking the customer to log in, with no
  navigation forced.
- `header.jsx`: new "Wishlist (n)" link next to "My Orders".

Frontend — unavailable-product handling (cart):
- `CartContext.jsx`: cart items are a `localStorage` snapshot taken
  at add-to-cart time, so price/stock/availability can silently drift
  after that — a new async `refreshCart()` re-fetches every line
  item's live product data and reconciles it. Two DISTINCT real-world
  cases, verified separately because they behave differently:
  - **Sellout** (`isAvailable: true`, `stock: 0`) — this is the
    common case in practice, because `createOrder`'s atomic
    `findOneAndUpdate` decrements stock on purchase but never flips
    `isAvailable`. The product still fetches fine (200), so the item
    stays visible in the cart, greyed out, flagged "No longer
    available," excluded from `cartTotal`/`cartItemCount`, with
    quantity controls removed and only a Remove button left.
  - **Delisting** (`isAvailable: false`) — `GET /api/product/:id`
    already 404s an unavailable product for non-admins (an existing
    Phase 9 convention, so an unavailable listing can't be probed/
    linked). From the cart's perspective this is indistinguishable
    from the product having been deleted outright, so it's handled
    the same way: silently dropped from the cart with a toast
    ("no longer sold"), not shown as a broken row.
  - **Partial stock loss** (stock reduced but still > 0): quantity is
    clamped down to the new stock level and a toast explains why.
- `cartPage.jsx`: calls `refreshCart()` on mount ("Checking
  availability…" shown while in flight); "Proceed to Checkout" is
  disabled with an inline hint whenever any unavailable item remains.
- `checkoutPage.jsx`: calls `refreshCart()` on mount too, as a safety
  net for a customer who reaches `/checkout` directly (back button,
  bookmark) with a cart that went stale since it was last opened in
  `/cart` — submitting with an unavailable item still present is
  blocked client-side and redirects back to `/cart` with a toast,
  rather than relying solely on the server's own order-creation
  validation to catch it after the fact.

Verified via curl: `GET/POST/DELETE /api/user/wishlist(/:productId)`
— empty wishlist, add, idempotent re-add, adding a nonexistent
productId → 404, full resolved doc returned by GET, remove, empty
again, both routes 401 with no token. Frontend E2E (real browser,
throwaway customer + a throwaway admin-created test product, both
cleaned up afterward): heart toggle updates the header's
"Wishlist (n)" count and the wishlist page; Add-to-Cart from the
wishlist page lands the item in the real cart; removing from the
wishlist returns it to the empty state. Unavailable handling tested
as three separate, deliberately distinguished scenarios: (1) stock
driven to 0 with `isAvailable` left `true` → item flagged in-place,
excluded from the subtotal, checkout button disabled, checkout page
itself also blocks and redirects back to `/cart`; (2) `isAvailable`
set to `false` → item silently dropped, cart correctly shows its
empty state rather than a broken row; (3) stock reduced from 3 to 1
(not to zero) → quantity auto-clamped to 1 on reload. All ten
assertions passed on a clean run. No new console errors during any
normal (fully-available) flow.

Commit:

```text
feat(shop): add wishlist and shopping enhancements
```

---

## Response #17 — Phase 15: AI Beauty & Style Concierge

Status: PASS

Provider decision: the roadmap didn't name an LLM provider. Asked —
developer initially chose Anthropic, then supplied a Google Gemini
API key instead, so the concierge runs on Gemini (model
`gemini-3.6-flash`, configurable via `GEMINI_MODEL` in `.env`) via
direct REST calls, not Anthropic. No SDK dependency was added — Node
22's built-in `fetch` is enough for one POST per request.

Backend:
- `utils/geminiClient.js` (new): thin wrapper around
  `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
  Sends a `systemInstruction` that fixes the model's role (a shopping/
  style concierge), forbids inventing any productId/name/price/stock
  not in the catalog it's given, forbids medical/dermatological/
  treatment advice, and tells it to return an empty recommendation
  with an explanation rather than force an unsuitable one. Forces the
  reply into `{productIds: string[], message: string}` via Gemini's
  `responseSchema` structured-output feature (JSON mode) — the model
  cannot return prose or extra fields, only that shape. One retry
  with a 1.5s backoff on a 503 ("high demand") — observed live during
  this phase's own manual testing, so it's a real, not hypothetical,
  failure mode.
- `controller/recommendController.js` (new): validates `message`
  (required, ≤500 chars) and an optional positive `budget`; fetches
  only `{isAvailable: true, stock: {$gt: 0}}` products (capped at 200)
  as the catalog handed to the LLM; calls `geminiClient`; then —
  critical, defense-in-depth step — **never trusts the LLM's
  productIds directly**. `responseSchema` only constrains shape (an
  array of strings), not membership, so the returned ids are
  intersected against the SAME freshly-fetched available-product map
  before resolving to full docs. Any Gemini/network failure is caught
  and surfaces as a clean `AppError(502, "...temporarily
  unavailable...")`, never a raw 500 — this is a nice-to-have feature,
  not core checkout.
- `routers/recommendRouter.js` (new): `POST /api/recommend`, public
  (a guest can use it, same as the cart), rate-limited to 8 requests
  per 15 minutes per IP (tighter than the login/contact limiters —
  each call is a real, billed, noticeably-slower LLM request).
- `index.js`: mounted at `/api/recommend`.
- `.env`: added `GEMINI_API_KEY` / `GEMINI_MODEL` (gitignored, never
  committed).

Frontend:
- `src/pages/client/conciergePage.jsx` (new, route `/concierge`,
  public — no `RequireAuth`, matching the cart's guest-friendly
  design): a single request/response form (textarea + optional
  budget), not a multi-turn chat thread — matches the roadmap's
  single-exchange example and avoids building conversation-history
  machinery the phase doesn't ask for. Renders the AI's message plus
  the REAL resolved `ProductCard`s it returned (the exact same
  component used everywhere else in the app — heart/wishlist toggle
  and Add-to-Cart both come for free, no new product-rendering code),
  with an "Add All to Cart" button that calls the existing
  `useCart().addToCart()` once per recommended product.
- `header.jsx`: "AI Concierge" link added to the PUBLIC nav group
  (next to Contact), not the logged-in-only group — the feature works
  for guests.

Verified via curl against the real Gemini API (no mocking): a
realistic elegant/budget request → returned exactly the one genuinely
matching real product, at its real price, with a real product `_id`,
never a fabricated one; a budget too small for anything in the
catalog → `products: []` with an honest explanation, not a forced
bad match; an adversarial request naming real-world brand products
that do NOT exist in this store's catalog (Lancôme, Dior) → correctly
refused, `products: []`, no hallucinated match; **a medical framing
attempt** ("will this cure my eczema/acne, give me a diagnosis and
treatment plan") → the model correctly refused to give medical advice
and stayed in the shopping lane, exactly the guardrail the roadmap
required; all four input-validation branches (empty/missing message,
>500 chars, negative budget) → 400; the 8/15-min rate limit was hit
organically during this same testing and correctly returned 429.
Frontend E2E (real browser, real Gemini calls, no mocking): the
public nav link is visible to a logged-out guest; submitting with an
empty message never enters the loading state; a real request renders
the AI's reply text and a real recommended product card (not a
fabricated one); "Add All to Cart" places the real product into the
actual cart, confirmed on `/cart`. Zero console errors throughout.

Commit:

```text
feat(ai): add beauty and style shopping concierge
```

---

## Response #18 — Phase 16: Cleanup

Status: PASS

Verified every item against actual references before touching
anything — nothing was deleted "because it looked unused."

Removed (confirmed dead via grep across BOTH repos, not assumption):

- Backend: `models/student.js`, `controller/studentController.js`,
  `routers/studentRouter.js`, and the `/api/student` mount in
  `index.js`. Notably `studentController.js` wasn't even imported by
  its own router — `studentRouter.js` had its own inline duplicate
  handlers — so it was dead on arrival, not just unused later.
- Backend: the `body` and `parser` npm packages — grepped for any
  `require`/`import` of either across the whole repo, zero hits.
  Removed via `npm uninstall` (updates `package-lock.json` too).
- Frontend: `src/pages/testPage.jsx` (a Supabase upload scratch page
  superseded by the real `src/utils/mediaUpload.jsx`, including a
  hardcoded, already-commented-out Supabase key in its source — noted
  below) and its `/testing/*` route + import in `App.jsx`.
- Frontend: `src/pages/admin/newPAge.jsx` — unreferenced anywhere,
  and would have thrown at runtime if it ever had been (uses
  `useState` without importing it).
- Frontend: `src/assets/sampleData.js` — its only use was
  `AdminProductPage`'s initial `useState`, which is always overwritten
  by the real `/api/product` fetch before the table's `isLoading`
  flag ever lets it render — provably inert, not merely "probably
  unused."
- Frontend: the `dotenv` npm package — grepped for any import, zero
  hits; Vite uses `import.meta.env`, this was never wired to anything.
- Leftover debug `console.log` calls in `mediaUpload.jsx`,
  `addProductPage.jsx`, `editProductPage.jsx`, and `register.jsx` —
  all already had proper toast-based user feedback, the logs were
  pure development cruft.

Also fixed, found during verification (falls under "other verified
development-only artifacts"): the live `/admin` root route
(`adminPage.jsx`) rendered literally `<h1>FUCK YOU</h1>` — real
placeholder profanity, reachable by any admin navigating to the bare
`/admin` URL. Replaced with `<Navigate to="/admin/products" replace />`,
landing on the sensible default tab instead. Also removed a chunk of
commented-out scratch JSX (an unused colored-boxes demo block) and a
stray leftover Supabase-URL comment from the bottom of `App.jsx`.

Verified but deliberately left alone (not dead code, just
out-of-scope for a cleanup phase):

- `/admin/reviews` — a harmless `<h1>REVIEW PAGE</h1>` stub for an
  admin review-moderation UI that was never built. This is a missing
  feature, not a development artifact to delete; building the real
  page is a feature addition beyond this phase's scope.
- The "profanity placeholder" roadmap bullet otherwise didn't apply —
  grepped for any profanity-filter/placeholder logic in either repo,
  none exists, so there was nothing else to remove under that item
  besides the `/admin` root fix above.
- The Supabase anon key hardcoded in `mediaUpload.jsx` — Supabase
  anon keys are designed to be public/client-exposed (protected by
  Row Level Security policies, not secrecy), so this isn't a
  dead-code deletion case. Moving it into a `VITE_` env var is a
  config-hygiene improvement that belongs to Phase 17 (Production
  Hardening), not this cleanup phase — noted for that phase instead
  of actioned here.
- Real junk product documents already sitting in the live MongoDB
  Atlas catalog (e.g. `adasd`, `adsaddasdad`) and the Phase-1-era
  broken `example.com` sample image URLs on seeded products — these
  are live database records, not code in this repo, and out of scope
  for a code-cleanup phase to silently edit.
- `npm audit`-reported vulnerabilities (pre-existing, both repos) —
  dependency version hardening is a Phase 17 concern, not cleanup.

Verified via a production build (`npm run build` — 197 modules
transformed, zero errors) and real browser testing (Playwright): the
old `/testing` route now correctly falls through to the app's own
404 page; logging in as the real admin account and landing on
`/admin` now redirects straight to `/admin/products` with the
product table rendering normally, no trace of the old placeholder
text anywhere in the DOM. Backend restarted clean with the student
router fully removed (`GET /api/student` now correctly 404s) and
`GET /api/product` still 200 with the trimmed dependency list. Zero
new console errors (only the same pre-existing, unrelated broken
`example.com` sample-image URLs already flagged as a known issue in
earlier phases).

Commit:

```text
chore(cleanup): remove dead code and development artifacts
```

---

# RESPONSE/COMMIT PROTOCOL

Every Claude response must use:

```text
RESPONSE NUMBER:
XX

PHASE:
Phase X — <name>

STATUS:
PASS / PASS WITH ISSUES / FAIL

FILES CREATED:
...

FILES MODIFIED:
...

FILES NOT MODIFIED:
...

WHAT WAS IMPLEMENTED:
...

ARCHITECTURE:
...

DATA FLOW:
...

TESTS PERFORMED:
1.
2.
3.

TEST RESULTS:
...

BUGS FOUND:
...

BUGS FIXED:
...

DEFERRED:
...

WHAT I LEARNED:
...

INTERVIEW QUESTIONS:
...

NEXT PHASE:
Response #XX — <name>

GIT COMMIT:
<exact commit message>
```

If incomplete:

```text
GIT COMMIT:
NO COMMIT — implementation incomplete.
```

Commit automatically at the end of a successful phase (per the developer's instruction from Response #06 onward), using this exact message, with no AI co-author line.

---

# PRE-AWS DEVELOPMENT ROADMAP

---

## Response #19 — Phase 17: Production Hardening

Backend review:

- env vars
- CORS
- security headers
- rate limiting
- validation
- error handling
- status codes
- DB connection
- graceful shutdown
- request limits
- authorization
- JWT
- password handling
- logging
- sensitive-data leakage

Frontend review:

- API config
- loading/error/empty states
- route handling
- accessibility
- responsiveness
- env vars
- no secrets
- no console errors

Learn:

- production hardening
- threat modeling
- configuration management
- observability

Commit:

```text
chore(prod): harden application for deployment
```

---

## Response #20 — Phase 18: Automated Testing

Create a reliable test suite.

Backend:

- registration/login
- authentication/authorization
- product CRUD
- order creation
- inventory concurrency
- order ownership
- admin orders
- user management
- reviews
- payment/webhooks
- AI recommendation validation

Frontend/E2E:

- Register
- Login
- Browse
- Product detail
- Cart
- Checkout
- Order
- My Orders
- Logout
- Admin

Use the project's existing Playwright approach where appropriate.

Learn:

- unit testing
- integration testing
- E2E testing
- regression testing

Commit:

```text
test: add application test suite
```

---

## Response #21 — Phase 19: Documentation & Final Pre-AWS Audit

Document:

- README
- architecture
- environment variables
- API
- local setup
- tests
- admin setup
- deployment prerequisites
- known limitations

Final audit must confirm:

```text
Frontend
  ↓
Backend
  ↓
Database
  ↓
Storage
  ↓
Auth
  ↓
Cart
  ↓
Checkout
  ↓
Inventory
  ↓
Orders
  ↓
Payment
  ↓
AI
```

Commit:

```text
docs: document application and deployment prerequisites
```

---

# PRE-AWS EXIT CHECKLIST

## Customer

- [ ] Registration
- [ ] Login
- [ ] Logout
- [ ] Forgot password if required
- [ ] Profile
- [ ] Product listing
- [ ] Product detail
- [ ] Search
- [ ] Filtering
- [ ] Pagination
- [ ] Cart
- [ ] Checkout
- [ ] Payment/COD
- [ ] Order confirmation
- [ ] My Orders
- [ ] Reviews
- [ ] Wishlist if included

## Admin

- [ ] Admin login
- [ ] Product CRUD
- [ ] Product image upload
- [ ] Order management
- [ ] User management
- [ ] Inventory management
- [ ] Server-side authorization

## Backend

- [ ] Authentication
- [ ] Authorization
- [ ] Validation
- [ ] Rate limiting
- [ ] CORS
- [ ] Central error handling
- [ ] Correct status codes
- [ ] Atomic stock control
- [ ] Order ownership
- [ ] Payment verification
- [ ] Logging
- [ ] Environment configuration

## Database

- [ ] User schema finalized
- [ ] Product schema finalized
- [ ] Order schema finalized
- [ ] Review schema finalized
- [ ] Appropriate indexes
- [ ] User/order relationship finalized
- [ ] Inventory behavior tested

## AI

- [ ] Recommendation endpoint
- [ ] Real catalog grounding
- [ ] Structured output
- [ ] Product ID validation
- [ ] No hallucinated products
- [ ] Cart integration
- [ ] Safe shopping-only scope

## Quality

- [ ] No placeholders
- [ ] No profanity
- [ ] No tutorial code
- [ ] No scratch routes
- [ ] No unnecessary debug logs
- [ ] No secrets in source
- [ ] Tests passing
- [ ] Browser E2E passing
- [ ] README complete

---

# GIT STRATEGY

Use **one logical commit per completed phase**.

Never make giant commits such as:

```text
final project
everything
AWS deployment
changes
fix stuff
```

Instead use the phase-specific commit messages above.

Before every phase:

```bash
git status
git log --oneline -5
```

After implementation:

```bash
git status
git diff
git diff --stat
```

After manual commit:

```bash
git log --oneline --decorate -5
```

If unrelated changes appear, stop and decide whether to revert, defer, or explicitly document them.

---

# RESPONSE ↔ COMMIT MAP

| Response | Phase                     | Commit                                                          |
| -------- | ------------------------- | --------------------------------------------------------------- |
| #01      | Security                  | `fix(security): harden backend foundation`                      |
| #02      | Browser verification      | No commit                                                       |
| #03      | Product detail            | `feat(product): add product detail page`                        |
| #04      | Cart                      | `feat(cart): implement persistent shopping cart`                |
| #05      | Checkout                  | `feat(checkout): implement customer checkout flow`              |
| #06      | Inventory                 | `fix(inventory): prevent overselling with atomic stock updates` |
| #07      | Customer orders           | `feat(orders): add customer order history`                      |
| #08      | Auth                      | `feat(auth): complete authentication and protected routes`      |
| #09      | Admin orders              | `feat(admin): add order management`                             |
| #10      | User management           | `feat(admin): add user management`                              |
| #11      | Search/filter/pagination  | `feat(product): add search, filtering, sorting and pagination`  |
| #12      | Reviews                   | `feat(reviews): add product reviews and ratings`                |
| #13      | Payment                   | `feat(payment): integrate secure payment flow`                  |
| #14      | Professional pages        | `feat(ui): build professional customer pages`                   |
| #15      | Profile                   | `feat(profile): add customer profile management`                |
| #16      | Wishlist                  | `feat(shop): add wishlist and shopping enhancements`            |
| #17      | AI Concierge              | `feat(ai): add beauty and style shopping concierge`             |
| #18      | Cleanup                   | `chore(cleanup): remove dead code and development artifacts`    |
| #19      | Production hardening      | `chore(prod): harden application for deployment`                |
| #20      | Testing                   | `test: add application test suite`                              |
| #21      | Documentation/final audit | `docs: document application and deployment prerequisites`       |

---

# HOW CLAUDE SHOULD USE THIS FILE

For every new task:

```text
Read ECOMMERCE_DEVELOPMENT_ROADMAP.md.

Find the first incomplete phase.

Execute ONLY that phase.

Before coding:
- inspect the relevant code
- explain the current architecture
- explain the planned implementation

After coding:
- run tests
- document implementation
- explain what was learned
- give interview questions
- give the exact commit message
- stop

Do not start the next phase.
```

The developer should no longer need to paste previous Claude responses into the chat. This file carries the project history, roadmap, scope boundaries and commit mapping.

---

# CURRENT NEXT PHASE

Completed:

```text
#01 PASS
#02 PASS
#03 PASS
#04 PASS
#05 PASS
#06 PASS
#07 PASS
#08 PASS
#09 PASS
#10 PASS
#11 PASS
#12 PASS
#13 PASS
#14 PASS
#15 PASS
#16 PASS
#17 PASS
#18 PASS
```

Next:

```text
Response #19
Phase 17 — Production Hardening
```

---

# AWS STAGE — AFTER ALL PRE-AWS PHASES

AWS must remain separate from application completion.

Expected high-level target:

```text
Internet
   |
Route 53
   |
CloudFront
   |
S3
   |
React static frontend


Internet
   |
Route 53
   |
ALB
   |
ECS Fargate
   |
Express API
   |
MongoDB Atlas

Supporting:
ECR
Secrets Manager
IAM
CloudWatch
Terraform
GitHub Actions
WAF if justified
```

Possible decisions:

- MongoDB Atlas vs DocumentDB
- ECS Fargate vs simpler compute
- Supabase Storage vs S3
- CloudFront/WAF scope
- CI/CD architecture

These decisions belong to the AWS stage, not the current MERN completion stage.

When AWS starts, continue the same response/commit system.

Possible AWS responses:

```text
#22 AWS architecture
#23 Docker backend
#24 Frontend production build/container strategy
#25 ECR
#26 ECS/Fargate
#27 ALB
#28 Route 53
#29 CloudFront/S3
#30 Secrets Manager/IAM
#31 CloudWatch
#32 Terraform
#33 GitHub Actions CI/CD
#34 Production deployment
#35 Final production verification
```

The exact AWS plan should be finalized after the pre-AWS exit audit.

---

# FINAL DEVELOPMENT LOOP

```text
UNDERSTAND
   ↓
INSPECT
   ↓
PLAN
   ↓
IMPLEMENT
   ↓
TEST
   ↓
DEBUG
   ↓
LEARN
   ↓
REVIEW
   ↓
MANUAL GIT COMMIT
   ↓
NEXT RESPONSE
```

The objective is not simply to finish the project with AI.

The objective is to be able to explain every important engineering decision months later, using the roadmap, Claude responses and Git history.
