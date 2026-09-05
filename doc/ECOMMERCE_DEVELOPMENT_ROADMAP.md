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

## Response #10 — Phase 8: User Management

Build admin functionality to:

- list users
- view users
- block/unblock
- manage roles where appropriate

Also fix the previously identified admin-creation logic.

Protect against dangerous role changes such as accidentally removing the last admin.

Learn:

- RBAC
- authorization
- administrative security

Commit:

```text
feat(admin): add user management
```

---

## Response #11 — Phase 9: Search, Filtering & Pagination

Backend:

- pagination
- search
- category filtering if supported
- price filtering if supported
- sorting

Frontend:

- search UI
- filters
- sorting
- pagination
- loading/empty states

Add MongoDB indexes only where justified by actual query patterns.

Learn:

- query parameters
- MongoDB queries
- pagination
- indexes
- server-side filtering

Commit:

```text
need a detailed meaningfull describing commit message
```

---

## Response #12 — Phase 10: Reviews & Ratings

Build:

- Review model
- create review
- display reviews
- rating validation
- one-review-per-user-per-product if appropriate
- edit/delete own review
- optional verified-purchase logic

Frontend:

- average rating
- reviews list
- review form

Learn:

- relationships
- compound indexes
- aggregation
- authorization
- verified purchase logic

Commit:

```text
feat(reviews): add product reviews and ratings
```

---

## Response #13 — Phase 11: Payment

Choose:

1. a real supported payment gateway, OR
2. Cash on Delivery.

If online payment is used:

```text
Checkout
  ↓
Create payment session/intent
  ↓
Payment provider
  ↓
Webhook
  ↓
Backend verification
  ↓
Order marked paid
```

Never store raw card details.

Never trust only a frontend payment-success redirect.

Learn:

- payment flow
- webhooks
- idempotency
- payment security
- server-side verification

Commit for online payment:

```text
feat(payment): integrate secure payment flow
```

COD alternative:

```text
feat(payment): add cash on delivery checkout
```

---

## Response #14 — Phase 12: Professional Customer Pages

Build real:

- Home
- About
- Contact

Home can include:

- hero
- featured products
- categories
- promotions
- value proposition
- AI Concierge CTA

Contact can include a proper form and only real/approved business contact information.

Learn:

- responsive UI
- accessibility
- semantic HTML
- component composition

Commit:

```text
feat(ui): build professional customer pages
```

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
| #11      | Search/filter/pagination  | `feat(product): add search filtering and pagination`            |
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
```

Next:

```text
Response #10
Phase 8 — User Management
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
