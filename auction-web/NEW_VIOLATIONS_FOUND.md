# Additional DRY & KISS Violations (Not in code-review-analysis.md)

> **Date:** 2026-02-27  
> **Scope:** All files in `src/` — every controller, service, model, utility, route, and middleware  
> **Legend:** Only violations that are **genuinely NEW** and not already documented in `code-review-analysis.md` (KISS 1-4, DRY 1-25)

---

## NEW DRY Violations

### DRY-NEW-1: `findByCategoryId` and `findByCategoryIds` are ~95% identical

**Files:** `models/product.model.js` ~L200-240 and ~L246-290

These two functions duplicate ~30 lines of identical code. The only difference is `.where('products.category_id', categoryId)` vs `.whereIn('products.category_id', categoryIds)`.

```javascript
// findByCategoryId (line ~200)
export function findByCategoryId(categoryId, limit, offset, sort, currentUserId) {
  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .leftJoin('watchlists', function() {
      this.on('products.id', '=', 'watchlists.product_id')
        .andOnVal('watchlists.user_id', '=', currentUserId || -1);
    })
    .where('products.category_id', categoryId)          // ← only diff
    .modify(scopeActive)
    .select('products.*', MASKED_BIDDER_NAME, BID_COUNT_SUBQUERY, IS_FAVORITE_CHECK)
    .modify((queryBuilder) => { /* sorting if-else chain */ })
    .limit(limit).offset(offset);
}

// findByCategoryIds (line ~246) — IDENTICAL except:
    .whereIn('products.category_id', categoryIds)        // ← only diff
```

> **Why it's DRY:** 30+ lines of identical query construction, join, select, sorting, and pagination code.
> **Note:** This is distinct from DRY #23 (seller product queries). DRY #23 covers `findActiveProductsBySellerId` etc.; this covers the category-search queries.

**Fix:** Merge into one function:

```javascript
export function findByCategoryFilter(
  categoryIds,
  limit,
  offset,
  sort,
  currentUserId,
) {
  const filter = Array.isArray(categoryIds)
    ? (q) => q.whereIn("products.category_id", categoryIds)
    : (q) => q.where("products.category_id", categoryIds);
  // ... shared query
}
```

---

### DRY-NEW-2: `getPaymentInvoice` and `getShippingInvoice` are identical except type string

**File:** `models/invoice.model.js` ~L89-96 and ~L101-113

```javascript
// getPaymentInvoice (line ~89)
export async function getPaymentInvoice(orderId) {
  return db('invoices')
    .leftJoin('users as issuer', 'invoices.issuer_id', 'issuer.id')
    .where('invoices.order_id', orderId)
    .where('invoices.invoice_type', 'payment')              // ← only diff
    .select('invoices.*', 'issuer.fullname as issuer_name')
    .first();
}

// getShippingInvoice (line ~101) — IDENTICAL except:
    .where('invoices.invoice_type', 'shipping')              // ← only diff
```

**Fix:** `getInvoiceByType(orderId, type)` with type = 'payment' | 'shipping'.

---

### DRY-NEW-3: `insertPaymentInvoice` / `insertShippingInvoice` — twin functions at model AND service layers

**Files:** `models/invoice.model.js` ~L18-35 + ~L37-53, AND `services/invoice.service.js` ~L67-82 + ~L87-106

Both insert functions in the **model** layer insert into the same `invoices` table with similar fields. Both service functions have the same structure: destructure → moveUploadedFiles → call model insert.

```javascript
// invoice.service.js — createPaymentInvoice
export async function createPaymentInvoice(invoiceData) {
  const { order_id, issuer_id, payment_method, payment_proof_urls, note } =
    invoiceData;
  const permanentUrls = moveUploadedFiles(payment_proof_urls, "payment_proofs");
  return invoiceModel.insertPaymentInvoice({
    order_id,
    issuer_id,
    payment_method,
    payment_proof_urls: permanentUrls,
    note,
  });
}

// invoice.service.js — createShippingInvoice  — SAME PATTERN:
export async function createShippingInvoice(invoiceData) {
  const {
    order_id,
    issuer_id,
    tracking_number,
    shipping_provider,
    shipping_proof_urls,
    note,
  } = invoiceData;
  const permanentUrls = moveUploadedFiles(
    shipping_proof_urls,
    "shipping_proofs",
  );
  return invoiceModel.insertShippingInvoice({
    order_id,
    issuer_id,
    tracking_number,
    shipping_provider,
    shipping_proof_urls: permanentUrls,
    note,
  });
}
```

> This is 4 "twin" functions across two layers (2 model + 2 service). A generic `createInvoice(type, data)` would eliminate the duplication.

---

### DRY-NEW-4: `findBySellerId` and `findByBuyerId` in order.model.js — mirror functions

**File:** `models/order.model.js` ~L120-137 and ~L139-156

```javascript
// findBySellerId
export async function findBySellerId(sellerId) {
  return db('orders')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as buyer', 'orders.buyer_id', 'buyer.id')     // ← user alias
    .where('orders.seller_id', sellerId)                            // ← filter
    .select('orders.*', 'products.name as product_name',
            'products.thumbnail as product_thumbnail',
            'buyer.fullname as buyer_name')                         // ← name column
    .orderBy('orders.created_at', 'desc');
}

// findByBuyerId — IDENTICAL structure, just mirrored:
    .leftJoin('users as seller', 'orders.seller_id', 'seller.id')   // ← mirror
    .where('orders.buyer_id', buyerId)                              // ← mirror
    .select(... 'seller.fullname as seller_name')                   // ← mirror
```

**Fix:** `findOrdersByUser(userId, role)` where role = 'buyer' | 'seller'.

---

### DRY-NEW-5: Five seller `count*` functions share the same base pattern

**File:** `models/product.model.js` ~L404-440

```javascript
// ALL five start the same way:
export function countProductsBySellerId(sellerId) {
  return db('products').where('seller_id', sellerId).count('id as count').first();
}
export function countActiveProductsBySellerId(sellerId) {
  return db('products').where('seller_id', sellerId)
    .where('end_at', '>', new Date()).whereNull('closed_at')          // ← filter
    .count('id as count').first();
}
export function countSoldProductsBySellerId(sellerId) {
  return db('products').where('seller_id', sellerId)
    .where('end_at', '<=', new Date()).where('is_sold', true)         // ← filter
    .count('id as count').first();
}
export function countPendingProductsBySellerId(sellerId) { ... }     // same base + filter
export function countExpiredProductsBySellerId(sellerId) { ... }     // same base + filter
```

> **Note:** This is distinct from DRY #23 which covers `findActive/Pending/Sold/ExpiredProductsBySellerId` (list queries). These are separate count-only queries used by `getSellerStats`.

**Fix:** Use a lookup map of scopes and call them from `getSellerStats` inline:

```javascript
const SELLER_SCOPES = {
  active: (q) => q.where("end_at", ">", new Date()).whereNull("closed_at"),
  sold: (q) => q.where("is_sold", true),
  // ...
};
function countByScope(sellerId, scope) {
  return db("products")
    .where("seller_id", sellerId)
    .modify(SELLER_SCOPES[scope])
    .count("id as count")
    .first();
}
```

---

### DRY-NEW-6: `getSoldProductsStats` and `getPendingProductsStats` — structurally identical aggregation

**File:** `models/product.model.js` ~L567-610

Both functions:

1. Query `db('products').where('seller_id', sellerId)`
2. Apply different WHERE filters
3. Select `COUNT`, `SUM(current_price)`, and a `SUM+subquery` for total_bids
4. Parse the result with `parseInt`/`parseFloat`

```javascript
// getSoldProductsStats
const result = await db("products")
  .where("seller_id", sellerId)
  .where("end_at", "<=", new Date())
  .where("is_sold", true) // ← only diff
  .select(
    db.raw("COUNT(products.id) as total_..."),
    db.raw("COALESCE(SUM(products.current_price), 0) as ..._revenue"),
    db.raw("COALESCE(SUM((...bid subquery...)), 0) as total_bids"),
  )
  .first();

// getPendingProductsStats — IDENTICAL structure with different filter
```

**Fix:** `getProductsStatsByScope(sellerId, scopeFn)`.

---

### DRY-NEW-7: Product URL construction repeated 3+ times in controllers

**Files:** `controllers/product.controller.js` ~L148, ~L161; `controllers/seller.controller.js` ~L168

```javascript
// controllers/product.controller.js
const productUrl = `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;
// appears in: postBid (L148), postComment (L161)

// controllers/seller.controller.js
const productUrl = `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;
// appears in: postAppendDescription (L168)
```

Also in `auctionEndNotifier.js` (L27):

```javascript
const productUrl = `${process.env.BASE_URL || "http://localhost:3005"}/products/detail?id=${auction.id}`;
```

**Fix:** Utility function:

```javascript
export function buildProductUrl(req, productId) {
  return `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;
}
```

---

### DRY-NEW-8: `bcrypt.hash`/`hashSync` with hardcoded salt rounds repeated 4 times

**Files:**

- `controllers/account.controller.js` ~L127: `bcrypt.hashSync(new_password, 10)`
- `controllers/account.controller.js` ~L211: `bcrypt.hashSync(req.body.password, 10)`
- `controllers/admin/user.controller.js` ~L34: `await bcrypt.hash(password, 10)`
- `controllers/admin/user.controller.js` ~L87: `await bcrypt.hash(defaultPassword, 10)`

**Fix:** Create a constant and utility:

```javascript
// utils/auth.js
const SALT_ROUNDS = 10;
export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}
```

---

### DRY-NEW-9: Seller ownership check pattern repeated 3 times in seller.controller.js

**File:** `controllers/seller.controller.js` ~L195-205, ~L215-225, ~L250-260

`getDescriptionUpdates`, `putDescriptionUpdate`, and `deleteDescriptionUpdate` all repeat:

```javascript
const product = await productModel.findByProductId2(update.product_id, null);
if (!product || product.seller_id !== sellerId) {
  return res.status(403).json({ success: false, message: "Unauthorized" });
}
```

And `putDescriptionUpdate` / `deleteDescriptionUpdate` both also repeat:

```javascript
const update = await productDescUpdateModel.findById(updateId);
if (!update) {
  return res.status(404).json({ success: false, message: "Update not found" });
}
```

**Fix:** Extract middleware or helper `validateSellerOwnsDescriptionUpdate(updateId, sellerId)`.

---

### DRY-NEW-10: `getWatchlist` re-implements pagination instead of using `getPagination`/`buildPaginationInfo`

**File:** `controllers/account.controller.js` ~L436-463

```javascript
// Manually reimplements what getPagination + buildPaginationInfo already do:
const limit = 3;
const page = parseInt(req.query.page) || 1;
const offset = (page - 1) * limit;
// ...
const nPages = Math.ceil(totalCount / limit);
let from = (page - 1) * limit + 1;
let to = page * limit;
if (to > totalCount) to = totalCount;
if (totalCount === 0) {
  from = 0;
  to = 0;
}
```

The identical logic already exists in `utils/pagination.js` and is used by `product.service.js`. This controller ignores the existing utility.

**Fix:** Use the existing utilities:

```javascript
const { page, limit, offset } = getPagination(req.query.page, 3);
const { totalPages, from, to } = buildPaginationInfo(page, limit, totalCount);
```

---

### DRY-NEW-11: `buyNow` reimplements validations that exist as helper functions in the same file

**File:** `services/bidding.service.js` ~L470-544

`placeBid` uses extracted helper functions: `validateProductExists`, `validateProductNotSold`, `validateBidderNotSeller`, `validateBidderNotRejected`, `validateBidderRating`, `validateAuctionActive`. But `buyNow` (~70 lines) re-implements all of these inline:

```javascript
// buyNow reimplements these validations inline:
if (!product) throw new Error("Product not found"); // = validateProductExists
if (product.seller_id === userId) throw new Error("..."); // = validateBidderNotSeller
if (product.is_sold !== null) throw new Error("..."); // = validateProductNotSold
if (endDate <= now || product.closed_at) throw new Error("..."); // = validateAuctionActive
// ...rejected check inline...                                       // = validateBidderNotRejected
// ...rating check inline...                                        // = validateBidderRating
```

**Fix:** Reuse the existing validation helpers:

```javascript
export async function buyNow(productId, userId) {
  await db.transaction(async (trx) => {
    const product = await validateProductExists(trx, productId);
    validateProductNotSold(product);
    validateBidderNotSeller(product, userId);
    await validateBidderNotRejected(trx, productId, userId);
    validateAuctionActive(product);
    // ... buy-now specific logic
  });
}
```

---

### DRY-NEW-12: Error-message-to-status-code mapping in `seller.controller.js` repeats a custom pattern

**File:** `controllers/seller.controller.js` ~L113-120 and ~L173-180

```javascript
// postCancelProduct (~L113)
if (error.message === "Product not found") {
  return res.status(404).json({ success: false, message: "Product not found" });
}
if (error.message === "Unauthorized") {
  return res.status(403).json({ success: false, message: "Unauthorized" });
}
res.status(500).json({ success: false, message: "Server error" });

// postAppendDescription (~L173) — same pattern:
const status =
  error.message === "Product not found"
    ? 404
    : error.message === "Unauthorized"
      ? 403
      : error.message === "Description is required"
        ? 400
        : 500;
res
  .status(status)
  .json({ success: false, message: error.message || "Server error" });
```

> **Note:** DRY #14 documents the `error.message === 'Unauthorized' ? 403 : 500` pattern in `product.controller.js`. But this is a separate, expanded pattern in `seller.controller.js` that maps multiple error messages to different HTTP statuses. Both should be unified.

**Fix:** Central error-to-status mapper utility (or custom Error classes with status codes).

---

## NEW KISS Violations

### KISS-NEW-1: `rejectBidder` in `bidding.service.js` (~100 lines with deep nesting)

**File:** `services/bidding.service.js` ~L370-462

This function has 4+ levels of conditional nesting inside a transaction for recalculating prices after rejecting a bidder. It handles 4 separate scenarios:

```javascript
export async function rejectBidder(productId, bidderId, sellerId) {
  await db.transaction(async (trx) => {
    // ... 15 lines of setup & validation ...

    // Price recalculation: 4 branches, deeply nested
    if (allAutoBids.length === 0) {
      // Case 1: No bids left → reset to starting price
      await trx('products').where('id', productId).update({ ... });
    } else if (allAutoBids.length === 1) {
      // Case 2: One bid left → set as winner
      const winner = allAutoBids[0];
      await trx('products').where('id', productId).update({ ... });
      if (wasHighestBidder || product.current_price !== product.starting_price) {
        await trx('bidding_history').insert({ ... });
      }
    } else if (wasHighestBidder) {
      // Case 3: Was highest, 2+ remaining → recalculate
      const firstBidder = allAutoBids[0];
      const secondBidder = allAutoBids[1];
      let newPrice = secondBidder.max_price + product.step_price;
      if (newPrice > firstBidder.max_price) newPrice = firstBidder.max_price;
      await trx('products').where('id', productId).update({ ... });
      const lastHistory = await trx('bidding_history')...;
      if (!lastHistory || lastHistory.current_price !== newPrice) {
        await trx('bidding_history').insert({ ... });
      }
    }
    // Implicit Case 4: Not highest bidder → no price change needed
  });
}
```

> **Why KISS:** The function does too much in one block — validation, deletion, 4-way price recalculation, history insertion. The recalculation logic alone is a complex algorithm that should be extracted.

**Fix:** Extract `recalculatePriceAfterRejection(trx, product, allAutoBids, wasHighestBidder)` as a dedicated function.

---

### KISS-NEW-2: `buyNow` has 7 sequential inline validation checks

**File:** `services/bidding.service.js` ~L470-544

```javascript
export async function buyNow(productId, userId) {
  await db.transaction(async (trx) => {
    const product = await trx('products')...;
    if (!product) throw new Error('Product not found');
    if (product.seller_id === userId) throw new Error('...');
    if (product.is_sold !== null) throw new Error('...');
    if (endDate <= now || product.closed_at) throw new Error('...');
    if (!product.buy_now_price) throw new Error('...');
    const isRejected = await trx('rejected_bidders')...;
    if (isRejected) throw new Error('...');
    if (!product.allow_unrated_bidder) {
      const ratingData = await reviewModel.calculateRatingPoint(userId);
      if (ratingPoint === 0) throw new Error('...');
    }
    // ... actual buy logic
  });
}
```

> **Why KISS:** 7 validation checks inline, each with its own error message, when the codebase already has extracted validator functions for the same checks. Makes the function long and hard to see the actual business logic.

---

### KISS-NEW-3: `getWonAuctionsByBidderId` — deeply nested WHERE clause

**File:** `models/autoBidding.model.js` ~L106-140

```javascript
.where(function() {
  this.where(function() {
    // Pending: (end_at <= NOW OR closed_at) AND is_sold IS NULL
    this.where(function() {                          // ← level 3 nesting
      this.where('products.end_at', '<=', new Date())
        .orWhereNotNull('products.closed_at');
    }).whereNull('products.is_sold');
  })
  .orWhere('products.is_sold', true)                 // Sold
  .orWhere('products.is_sold', false);               // Cancelled
})
```

> **Why KISS:** 3+ levels of nested `.where` callbacks makes the query condition very hard to read. The combination of OR and AND with nested groups is error-prone.

**Fix:** Use a raw SQL WHERE clause or extract the condition:

```javascript
.whereRaw(`
  (products.is_sold IS NOT NULL) OR
  ((products.end_at <= NOW() OR products.closed_at IS NOT NULL) AND products.is_sold IS NULL)
`)
```

---

### KISS-NEW-4: `countExpiredProductsBySellerId` — triple-nested `.where` callbacks

**File:** `models/product.model.js` ~L428-440

```javascript
export function countExpiredProductsBySellerId(sellerId) {
  return db("products")
    .where("seller_id", sellerId)
    .where(function () {
      // ← level 1
      this.where(function () {
        // ← level 2
        this.where("end_at", "<=", new Date()) // ← level 3
          .whereNull("highest_bidder_id");
      }).orWhere("is_sold", false);
    })
    .count("id as count")
    .first();
}
```

Similarly, `countPendingProductsBySellerId` (~L418) has:

```javascript
.where(function() {
  this.where('end_at', '<=', new Date())
    .orWhereNotNull('closed_at');
})
.whereNotNull('highest_bidder_id')
.whereNull('is_sold')
```

> **Why KISS:** Hard to reason about the exact filter conditions. A named scope or comment explaining the business rule would help.

---

### KISS-NEW-5: Magic numbers/strings scattered without constants

**Files:** Multiple

| Magic Value          | Location                                                                | Meaning                             |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `10`                 | `account.controller.js` L127, L211; `admin/user.controller.js` L34, L87 | bcrypt salt rounds                  |
| `'123'`              | `admin/user.controller.js` ~L84                                         | Default password on reset           |
| `15 * 60 * 1000`     | `services/otp.service.js` ~L38                                          | OTP expiry (15 minutes)             |
| `50mb`               | `index.js` ~L46-47                                                      | Request body size limit             |
| `{ min: 0, max: 7 }` | `utils/db.js` ~L9                                                       | DB connection pool config           |
| `2`                  | `services/product.service.js` ~L316                                     | Comments per page                   |
| `5 * 1024 * 1024`    | `routes/product.route.js` ~L22                                          | Max file size (5MB)                 |
| `10`                 | `routes/shared/upload.route.js` ~L22                                    | Max sub-images                      |
| `5`                  | `routes/product.route.js` ~L63                                          | Max order proof images              |
| `3`                  | `controllers/account.controller.js` ~L437                               | Watchlist page size                 |
| `3`                  | `services/product.service.js` ~L148                                     | Product page size                   |
| `100000`, `900000`   | `services/otp.service.js` ~L4                                           | OTP range (6-digit)                 |
| `1E9`                | `routes/product.route.js` ~L16; `routes/shared/upload.route.js` ~L8     | Random suffix for filenames         |
| `30`                 | `index.js` ~L410                                                        | Auction notifier interval (seconds) |

> **Why KISS:** Readers must guess the purpose of each number. Changes require hunting across multiple files.

**Fix:** Create `utils/constants.js`:

```javascript
export const BCRYPT_SALT_ROUNDS = 10;
export const OTP_EXPIRY_MS = 15 * 60 * 1000;
export const DEFAULT_PAGE_SIZE = 3;
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
export const MAX_SUB_IMAGES = 10;
// etc.
```

---

### KISS-NEW-6: `putProfile` in `account.controller.js` — too many concerns interleaved

**File:** `controllers/account.controller.js` ~L360-410

This ~50 line function handles:

1. OAuth vs non-OAuth user detection
2. Old password verification (only for non-OAuth)
3. Email uniqueness check
4. New password match validation (only for non-OAuth)
5. Building the update object with conditional fields
6. Database update
7. Session update
8. Redirect

```javascript
export const putProfile = async (req, res) => {
  const { email, fullname, address, date_of_birth, old_password, new_password, confirm_new_password } = req.body;
  const currentUser = await userModel.findById(currentUserId);

  if (!currentUser.oauth_provider) {                          // branch 1: OAuth check
    if (!old_password || !bcrypt.compareSync(...)) {           // branch 2: password check
      return res.render('vwAccount/profile', { ... });
    }
  }
  if (email !== currentUser.email) {                          // branch 3: email change
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) { return res.render(...); }
  }
  if (!currentUser.oauth_provider && new_password) {          // branch 4: new password
    if (new_password !== confirm_new_password) { return res.render(...); }
  }
  // ... build entity, conditionally add password_hash ...
  // ... update DB, update session, redirect ...
};
```

> **Why KISS:** Multiple interleaved concerns with 4+ branching conditions. Hard to test any one aspect independently.

**Fix:** Extract validation into a separate function, e.g. `validateProfileUpdate(currentUser, body)` that returns errors or null.

---

### KISS-NEW-7: `postSignup` — inline reCAPTCHA HTTP fetch inside controller

**File:** `controllers/account.controller.js` ~L179-230

```javascript
export const postSignup = async (req, res) => {
  // ...
  if (!recaptchaResponse) {
    errors.captcha = "Please check the captcha box.";
  } else {
    const secretKey = process.env.RECAPTCHA_SECRET;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;
    try {
      const response = await fetch(verifyUrl, { method: "POST" });
      const data = await response.json();
      if (!data.success) {
        errors.captcha = "Captcha verification failed. Please try again.";
      }
    } catch (err) {
      console.error("Recaptcha error:", err);
      errors.captcha = "Error connecting to captcha server.";
    }
  }
  // ... then 20 more lines of field validation ...
  // ... then user creation + OTP ...
};
```

> **Why KISS:** An HTTP call to an external API is embedded inside 50+ lines of form validation. The reCAPTCHA concern should be extracted.

**Fix:** Extract `utils/recaptcha.js`:

```javascript
export async function verifyCaptcha(response) {
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${response}`;
  const res = await fetch(verifyUrl, { method: "POST" });
  const data = await res.json();
  return data.success;
}
```

---

### KISS-NEW-8: `format_time_remaining` Handlebars helper internally re-implements date formatting

**File:** `index.js` ~L140-180

This ~40 line helper does time-diff calculation AND has an internal date formatting block that duplicates `format_date`:

```javascript
format_time_remaining(date) {
  const now = new Date();
  const end = new Date(date);
  console.log(end);                                        // ← debug log left in
  const diff = end - now;
  if (diff <= 0) return 'Auction Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  // ...
  if (days > 3) {
    // ↓ Re-implements format_date logic that already exists as a helper ↓
    if (isNaN(end.getTime())) return '';
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const day = String(end.getDate()).padStart(2, '0');
    const hour = String(end.getHours()).padStart(2, '0');
    const minute = String(end.getMinutes()).padStart(2, '0');
    const second = String(end.getSeconds()).padStart(2, '0');
    return `${hour}:${minute}:${second} ${day}/${month}/${year}`
  }
  // ... 4 more branching conditions ...
}
```

> **Why KISS:** 6 branching conditions, internal date formatting duplication, and a stale `console.log(end)` debug statement. Could call the existing `format_date` helper for the date display case.

---

### KISS-NEW-9: `postSettings` in `admin/system.controller.js` — duplicates `getSettings` logic in catch block

**File:** `controllers/admin/system.controller.js` ~L36-62

```javascript
export const postSettings = async (req, res) => {
  try {
    // 3 sequential await calls instead of a loop or batch:
    await systemSettingModel.updateSetting('new_product_limit_minutes', ...);
    await systemSettingModel.updateSetting('auto_extend_trigger_minutes', ...);
    await systemSettingModel.updateSetting('auto_extend_duration_minutes', ...);

    res.redirect('/admin/system/settings?success=...');
  } catch (error) {
    // ↓ DUPLICATES the ENTIRE getSettings logic (defaults + array-to-object) ↓
    const settingsArray = await systemSettingModel.getAllSettings();
    const settings = {
      new_product_limit_minutes: 60,           // ← duplicate defaults
      auto_extend_trigger_minutes: 5,
      auto_extend_duration_minutes: 10
    };
    if (settingsArray && settingsArray.length > 0) {
      settingsArray.forEach(setting => {       // ← duplicate conversion
        settings[setting.key] = parseInt(setting.value);
      });
    }
    res.render('vwAdmin/system/setting', { settings, error_message: '...' });
  }
};
```

> **Why KISS:** The catch block entirely re-implements the settings-fetching logic from `getSettings`. Also, the 3 sequential await calls could be a loop over an object or `Promise.all`.

**Fix:** Reuse the getSettings helper (DRY #19 partially covered the defaults, but the catch-block duplication is a separate KISS concern):

```javascript
} catch (error) {
  const settings = await getSettingsWithDefaults();
  res.render('vwAdmin/system/setting', { settings, error_message: '...' });
}
```

---

### KISS-NEW-10: `calculateNewPrice` in `bidding.service.js` — 5+ conditional branches

**File:** `services/bidding.service.js` ~L151-198

```javascript
function calculateNewPrice(product, bidAmount, userId) {
  // Branch A: Pre-check if current highest bidder's max >= buy_now_price
  if (buyNowPrice && product.highest_bidder_id && product.highest_max_price && product.highest_bidder_id !== userId) {
    const currentHighestMaxPrice = parseFloat(product.highest_max_price);
    if (currentHighestMaxPrice >= buyNowPrice) {
      return { ...buyNowTriggered: true };                      // early return 1
    }
  }

  if (product.highest_bidder_id === userId) {
    // Branch B: Same bidder updating max price
  } else if (!product.highest_bidder_id || !product.highest_max_price) {
    // Branch C: First bid ever
  } else {
    // Branch D: Competing bids
    if (bidAmount <= currentHighestMaxPrice) {
      // Branch D1: New bid loses
    } else {
      // Branch D2: New bid wins
    }
  }

  // Branch E: Check buy-now trigger
  if (buyNowPrice && newCurrentPrice >= buyNowPrice) { ... }

  return { ... };
}
```

> **Why KISS:** 5+ distinct branches with compound conditions make this function hard to follow. Each branch represents a separate pricing scenario that could be extracted into its own function.

---

## Summary

| Type     | ID     | Location                                                           | Severity  |
| -------- | ------ | ------------------------------------------------------------------ | --------- |
| **DRY**  | NEW-1  | `product.model.js` findByCategoryId vs findByCategoryIds           | 🟡 Medium |
| **DRY**  | NEW-2  | `invoice.model.js` getPaymentInvoice vs getShippingInvoice         | 🟡 Medium |
| **DRY**  | NEW-3  | `invoice.model.js` + `invoice.service.js` — 4 twin functions       | 🟡 Medium |
| **DRY**  | NEW-4  | `order.model.js` findBySellerId vs findByBuyerId                   | 🟢 Low    |
| **DRY**  | NEW-5  | `product.model.js` — 5 seller count functions                      | 🟡 Medium |
| **DRY**  | NEW-6  | `product.model.js` getSoldProductsStats vs getPendingProductsStats | 🟡 Medium |
| **DRY**  | NEW-7  | Controllers — product URL construction ×3                          | 🟢 Low    |
| **DRY**  | NEW-8  | Controllers — bcrypt salt rounds hardcoded ×4                      | 🟡 Medium |
| **DRY**  | NEW-9  | `seller.controller.js` — seller ownership check ×3                 | 🟢 Low    |
| **DRY**  | NEW-10 | `account.controller.js` — pagination reimplemented                 | 🟡 Medium |
| **DRY**  | NEW-11 | `bidding.service.js` — buyNow reimplements validations             | 🔴 High   |
| **DRY**  | NEW-12 | `seller.controller.js` — error-to-status mapping ×2                | 🟢 Low    |
| **KISS** | NEW-1  | `bidding.service.js` rejectBidder ~100 lines, nested               | 🔴 High   |
| **KISS** | NEW-2  | `bidding.service.js` buyNow 7 inline validations                   | 🟡 Medium |
| **KISS** | NEW-3  | `autoBidding.model.js` nested WHERE 3+ levels                      | 🟡 Medium |
| **KISS** | NEW-4  | `product.model.js` count functions triple-nested .where            | 🟡 Medium |
| **KISS** | NEW-5  | Multiple files — magic numbers everywhere                          | 🔴 High   |
| **KISS** | NEW-6  | `account.controller.js` putProfile too many concerns               | 🟡 Medium |
| **KISS** | NEW-7  | `account.controller.js` postSignup inline HTTP fetch               | 🟡 Medium |
| **KISS** | NEW-8  | `index.js` format_time_remaining re-implements formatting          | 🟢 Low    |
| **KISS** | NEW-9  | `admin/system.controller.js` catch block duplicates logic          | 🟡 Medium |
| **KISS** | NEW-10 | `bidding.service.js` calculateNewPrice 5+ branches                 | 🟡 Medium |

**Total: 12 new DRY violations + 10 new KISS violations = 22 additional violations found.**
