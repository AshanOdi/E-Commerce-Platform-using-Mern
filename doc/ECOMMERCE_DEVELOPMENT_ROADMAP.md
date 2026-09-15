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

## Response #15 — Phase 13: Customer Profile

Build:

- profile page
- update name
- phone
- address
- profile image if required
- validation
- protected profile route

Learn:

- PATCH APIs
- user-owned resources
- protected forms

Commit:

```text
feat(profile): add customer profile management
```

---

## Response #16 — Phase 14: Wishlist & Shopping Enhancements

Build only features that fit the actual business model:

- wishlist
- remove wishlist item
- add wishlist item to cart
- unavailable-product handling
- optional coupon foundation

Learn:

- user-specific data
- relationships
- state synchronization

Commit:

```text
feat(shop): add wishlist and shopping enhancements
```

---

## Response #17 — Phase 15: AI Beauty & Style Concierge

This is the main differentiating feature.

Example:

```text
I need a skincare/costume bundle for a party.
My budget is Rs. 10,000.
I want something elegant.
```

Architecture:

```text
Customer
  ↓
AI Concierge
  ↓
POST /api/recommend
  ↓
Backend
  ↓
Real MongoDB product catalog
  ↓
LLM
  ↓
Structured product IDs
  ↓
Backend validates IDs
  ↓
Backend resolves real products
  ↓
Frontend recommendations
  ↓
Add All to Cart
```

The LLM must never invent product IDs, names, prices, stock or availability.

Keep the feature as shopping/style recommendation, not medical diagnosis or treatment.

Learn:

- LLM integration
- prompt engineering
- structured output
- hallucination prevention
- retrieval from application data
- AI + traditional backend architecture

Commit:

```text
feat(ai): add beauty and style shopping concierge
```

---

## Response #18 — Phase 16: Cleanup

Remove after verifying references:

- student model/controller/router
- `/api/student`
- Supabase testing page/route
- profanity placeholder
- dead dependencies
- debug logs
- obsolete sample data
- other verified development-only artifacts

Do not delete code merely because it looks unused; verify first.

Commit:

```text
chore(cleanup): remove dead code and development artifacts
```

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
```

Next:

```text
Response #15
Phase 13 — Customer Profile
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
