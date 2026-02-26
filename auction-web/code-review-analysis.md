# Phân Tích Vi Phạm Nguyên Lý Thiết Kế Phần Mềm - Auction Web

> **Ngày phân tích:** 23/02/2026  
> **Phạm vi:** Toàn bộ source code trong thư mục `src/`

---

## Mục lục

1. [Tổng quan kiến trúc hiện tại](#1-tổng-quan-kiến-trúc-hiện-tại)
2. [Vi phạm nguyên lý SOLID](#2-vi-phạm-nguyên-lý-solid)
3. [Vi phạm nguyên lý KISS](#3-vi-phạm-nguyên-lý-kiss)
4. [Vi phạm nguyên lý DRY](#4-vi-phạm-nguyên-lý-dry)
5. [Vi phạm nguyên lý YAGNI](#5-vi-phạm-nguyên-lý-yagni)
6. [Đề xuất Design Patterns](#6-đề-xuất-design-patterns)
7. [Lộ trình Refactor](#7-lộ-trình-refactor)

---

## 1. Tổng quan kiến trúc hiện tại

Dự án sử dụng kiến trúc **2-layer** (Route → Model), thiếu tầng **Service/Business Logic** trung gian. Toàn bộ business logic được nhúng trực tiếp trong route handlers.

```
┌─────────────┐     ┌──────────────┐
│   Routes     │ ──► │   Models     │
│ (Controller  │     │ (Data Access)│
│ + Business   │     │              │
│   Logic)     │     │              │
└─────────────┘     └──────────────┘
```

**Nên chuyển sang:**

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Routes     │ ──► │  Services    │ ──► │   Models     │
│ (Controller) │     │ (Business    │     │ (Data Access)│
│              │     │   Logic)     │     │              │
└─────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Vi phạm nguyên lý SOLID

### 2.1. Single Responsibility Principle (SRP) — Vi phạm NGHIÊM TRỌNG

> _"Một class/module nên chỉ có MỘT lý do để thay đổi."_

#### Vi phạm 1: `routes/product.route.js` (1860 dòng) — God File

File này đảm nhận **quá nhiều trách nhiệm** cùng lúc:

| Trách nhiệm                                       | Dòng code |
| ------------------------------------------------- | --------- |
| Bidding logic (auto-bidding, buy-now, validation) | ~300 dòng |
| Email template generation & sending               | ~250 dòng |
| Order management (payment, shipping, delivery)    | ~200 dòng |
| Comment/Q&A logic                                 | ~150 dòng |
| Product detail logic + status determination       | ~100 dòng |
| Reject/Unreject bidder logic                      | ~200 dòng |
| Rating logic                                      | ~80 dòng  |
| Chat messages (HTML generation!)                  | ~50 dòng  |
| Image upload                                      | ~30 dòng  |
| File path manipulation                            | Rải rác   |

**Cụ thể:**

```javascript
// routes/product.route.js - Route handler POST /bid chứa:
// 1. Input validation
// 2. Database transaction logic
// 3. Auto-bidding algorithm
// 4. Auto-extend auction logic
// 5. Buy-now price logic
// 6. Rating point validation
// 7. Email template HTML (3 email templates dài ~200 dòng)
// 8. Flash message logic
// → TẤT CẢ trong 1 route handler!
```

**Đề xuất sửa:** Tách thành các module riêng biệt:

- `services/bidding.service.js` — Logic đấu giá
- `services/email.service.js` — Email templates & sending
- `services/order.service.js` — Quản lý đơn hàng
- `services/rating.service.js` — Logic đánh giá
- Tách các nhóm route thành sub-routers riêng

#### Vi phạm 2: `routes/account.route.js` (725 dòng)

File này đảm nhận:

- Authentication (signin/signup)
- Email verification (OTP)
- Password reset flow
- Profile management
- Watchlist management
- Bidding products management
- Won auctions management
- Rating management
- OAuth callbacks (Google, Facebook, GitHub)
- Upgrade request

**Đề xuất sửa:** Tách thành:

- `routes/auth.route.js` — Signin, signup, OTP, password reset
- `routes/profile.route.js` — Profile CRUD
- `routes/oauth.route.js` — OAuth callbacks
- Giữ `routes/account.route.js` cho watchlist, bidding, won auctions

#### Vi phạm 3: `index.js` (408 dòng) — Chứa Handlebars helpers

```javascript
// index.js chứa ~120 dòng Handlebars helper functions
app.engine(
  "handlebars",
  engine({
    helpers: {
      mask_name(fullname) {
        /* 15 dòng logic */
      },
      format_date(date) {
        /* 10 dòng */
      },
      format_only_date(date) {
        /* 8 dòng */
      },
      format_only_time(time) {
        /* 8 dòng */
      },
      format_date_input(date) {
        /* 7 dòng */
      },
      time_remaining(date) {
        /* 8 dòng */
      },
      format_time_remaining(date) {
        /* 30 dòng */
      },
      getPaginationRange(currentPage, totalPages) {
        /* 15 dòng */
      },
      // ... 15+ helper functions khác
    },
  }),
);
```

**Đề xuất sửa:** Tách helpers ra file riêng:

```javascript
// utils/handlebarsHelpers.js
export const helpers = { mask_name, format_date, ... };
```

#### Vi phạm 4: `models/product.model.js` (836 dòng) — Model kiêm Business Logic

Model chứa cả:

- Data access (CRUD, queries) — đúng trách nhiệm
- Business logic phức tạp: `cancelProduct()` chứa logic cancel orders, update product status
- `getSellerStats()` chứa 7 queries song song
- `findByProductId2()` chứa image aggregation logic

#### Vi phạm 5: Route handler sinh HTML trực tiếp

```javascript
// routes/product.route.js dòng ~1770 - GET /order/:orderId/messages
// Route handler tạo HTML string trực tiếp!
messagesHtml += `
  <div class="chat-message ${messageClass}">
    <div class="chat-bubble ${bubbleClass}">
      <div>${msg.message}</div>
      <div style="font-size: 0.7rem;">${formattedDate}</div>
    </div>
  </div>
`;
```

**Đề xuất sửa:** Dùng partial template hoặc trả JSON thuần để client render.

---

### 2.2. Open/Closed Principle (OCP) — Vi phạm TRUNG BÌNH

> _"Module nên mở cho mở rộng, đóng cho sửa đổi."_

#### Vi phạm 1: Sorting logic bằng if-else chains

```javascript
// models/product.model.js - Lặp lại ở findByCategoryId, findByCategoryIds, searchPageByKeywords
if (sort === "price_asc") {
  queryBuilder.orderBy("products.current_price", "asc");
} else if (sort === "price_desc") {
  queryBuilder.orderBy("products.current_price", "desc");
} else if (sort === "newest") {
  queryBuilder.orderBy("products.created_at", "desc");
} else if (sort === "oldest") {
  queryBuilder.orderBy("products.created_at", "asc");
} else {
  queryBuilder.orderBy("products.created_at", "desc");
}
```

→ Thêm sort option mới = phải sửa tất cả các hàm.

**Đề xuất sửa:** Dùng **Strategy Pattern** với sort map:

```javascript
const SORT_STRATEGIES = {
  price_asc: { column: "products.current_price", order: "asc" },
  price_desc: { column: "products.current_price", order: "desc" },
  newest: { column: "products.created_at", order: "desc" },
  oldest: { column: "products.created_at", order: "asc" },
  default: { column: "products.end_at", order: "asc" },
};

function applySorting(query, sort) {
  const strategy = SORT_STRATEGIES[sort] || SORT_STRATEGIES.default;
  return query.orderBy(strategy.column, strategy.order);
}
```

#### Vi phạm 2: Product status determination bằng if-else

```javascript
// routes/product.route.js - Lặp lại ở GET /detail và GET /complete-order
let productStatus = "ACTIVE";
if (product.is_sold === true) {
  productStatus = "SOLD";
} else if (product.is_sold === false) {
  productStatus = "CANCELLED";
} else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
  productStatus = "PENDING";
} else if (endDate <= now && !product.highest_bidder_id) {
  productStatus = "EXPIRED";
}
```

**Đề xuất sửa:** Tách thành utility function hoặc method trong service:

```javascript
// services/product.service.js
export function determineProductStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  if (product.is_sold === true) return "SOLD";
  if (product.is_sold === false) return "CANCELLED";
  if ((endDate <= now || product.closed_at) && product.highest_bidder_id)
    return "PENDING";
  if (endDate <= now && !product.highest_bidder_id) return "EXPIRED";
  return "ACTIVE";
}
```

#### Vi phạm 3: OAuth Strategies lặp cấu trúc

```javascript
// utils/passport.js - Mỗi strategy (Google, Facebook, GitHub) lặp logic giống nhau:
// 1. Tìm user by OAuth provider
// 2. Tìm user by email
// 3. Nếu có, add OAuth provider
// 4. Nếu không, tạo user mới
```

**Đề xuất sửa:** Tạo generic OAuth handler:

```javascript
function createOAuthCallback(providerName, getEmail, getDisplayName) {
  return async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await userModel.findByOAuthProvider(providerName, profile.id);
      if (user) return done(null, user);

      const email = getEmail(profile);
      if (email) {
        user = await userModel.findByEmail(email);
        if (user) {
          await userModel.addOAuthProvider(user.id, providerName, profile.id);
          return done(null, user);
        }
      }

      const newUser = await userModel.add({
        email: email || `${providerName}_${profile.id}@oauth.local`,
        fullname: getDisplayName(profile),
        password_hash: null,
        address: "",
        role: "bidder",
        email_verified: true,
        oauth_provider: providerName,
        oauth_id: profile.id,
      });
      done(null, newUser);
    } catch (error) {
      done(error, null);
    }
  };
}
```

---

### 2.3. Liskov Substitution Principle (LSP) — Không áp dụng trực tiếp

Dự án sử dụng functional programming (module exports), không có class hierarchy → LSP không bị vi phạm rõ ràng.

Tuy nhiên, có **inconsistency** trong API giữa `review.model.js`:

- `createReview(reviewData)` — nhận object có trường `reviewer_id`, `reviewee_id`
- `create(data)` — nhận object có trường `reviewer_id`, `reviewed_user_id` (khác tên!)

Hai hàm làm cùng một việc nhưng interface khác nhau, gây nhầm lẫn.

---

### 2.4. Interface Segregation Principle (ISP) — Vi phạm NHẸ

> _"Client không nên bị buộc phụ thuộc vào interface mà nó không sử dụng."_

#### Vi phạm: `product.model.js` export quá nhiều hàm (40+ exports)

Tất cả consumers đều import cùng một module mặc dù chỉ cần một phần nhỏ:

```javascript
// routes/home.route.js - Chỉ cần 3 hàm nhưng import toàn bộ module
import * as productModel from "../models/product.model.js";
// productModel có 40+ hàm - home chỉ dùng findTopEnding, findTopBids, findTopPrice
```

**Đề xuất sửa:** Tách thành các module nhỏ hơn:

- `models/product/product.query.js` — Các hàm query
- `models/product/product.command.js` — CRUD operations
- `models/product/product.seller.js` — Seller-specific queries
- `models/product/product.stats.js` — Statistics queries

---

### 2.5. Dependency Inversion Principle (DIP) — Vi phạm NGHIÊM TRỌNG

> _"Module cấp cao không nên phụ thuộc module cấp thấp. Cả hai nên phụ thuộc vào abstraction."_

#### Vi phạm 1: Routes phụ thuộc trực tiếp vào Database instance

```javascript
// routes/product.route.js
import db from "../utils/db.js"; // Route trực tiếp import DB connection!

// Sử dụng db trực tiếp trong route handler:
await db.transaction(async (trx) => {
  const product = await trx("products")
    .where("id", productId)
    .forUpdate()
    .first();
  // ...
});
```

Route layer (high-level) phụ thuộc trực tiếp vào Knex DB instance (low-level).

**Đề xuất sửa:** Chuyển tất cả database operations vào Service/Model layer. Route chỉ nên gọi service methods.

#### Vi phạm 2: `utils/db.js` hardcode connection credentials

```javascript
// utils/db.js - Hardcode thông tin kết nối!
export default knex({
  client: "pg",
  connection: {
    host: "aws-1-ap-southeast-2.pooler.supabase.com",
    post: 5432, // BUG: 'post' thay vì 'port'!
    user: "postgres.oirldpzqsfngdmisrakp",
    password: "WYaxZ0myJw9fIbPH", // ⚠️ Password lộ trong source code!
    database: "postgres",
  },
});
```

**Vấn đề:**

1. **BẢO MẬT:** Password database lộ trong source code
2. **BUG:** `post: 5432` → phải là `port: 5432`
3. Không sử dụng environment variables

**Đề xuất sửa:**

```javascript
export default knex({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});
```

#### Vi phạm 3: Hardcode session secret

```javascript
// index.js
app.use(
  session({
    secret:
      "x8w3v9p2q1r7s6t5u4z0a8b7c6d5e4f3g2h1j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3",
    // ...
  }),
);
```

**Đề xuất sửa:** Chuyển sang `process.env.SESSION_SECRET`.

---

## 3. Vi phạm nguyên lý KISS (Keep It Simple, Stupid)

> _"Giữ thiết kế đơn giản nhất có thể."_

### Vi phạm 1: Route handler POST `/bid` quá phức tạp (~400 dòng)

Một route handler duy nhất chứa: validation, business logic, database transaction, auto-bidding algorithm, email sending. Rất khó để đọc, test và debug.

### Vi phạm 2: Inline Email Templates (HTML dài trong JS)

```javascript
// routes/product.route.js - Email template ~80 dòng HTML inline
emailPromises.push(
  sendMail({
    to: seller.email,
    subject: `💰 New bid on your product: ${result.productName}`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">New Bid Received!</h1>
      </div>
      // ... 70+ dòng HTML inline nữa
    </div>
  `,
  }),
);
```

Có **ít nhất 10 email templates** được viết inline trong route files, mỗi template dài 30-80 dòng HTML.

**Đề xuất sửa:**

- Sử dụng Handlebars templates riêng cho email: `views/emails/bid-notification.handlebars`
- Hoặc tạo `utils/emailTemplates.js` để chứa các template functions

### Vi phạm 3: Path manipulation phức tạp và lặp đi lặp lại

```javascript
// routes/admin/product.route.js & routes/seller.route.js
const mainPath = path
  .join(dirPath, `p${returnedID[0].id}_thumb.jpg`)
  .replace(/\\/g, "/");
const oldMainPath = path
  .join("public", "uploads", path.basename(product.thumbnail))
  .replace(/\\/g, "/");
const savedMainPath =
  "/" +
  path
    .join("images", "products", `p${returnedID[0].id}_thumb.jpg`)
    .replace(/\\/g, "/");
```

**Đề xuất sửa:** Tạo utility function:

```javascript
// utils/fileHelper.js
export function getProductImagePath(productId, suffix) {
  return `/images/products/p${productId}_${suffix}.jpg`;
}
export function moveUploadedFile(tempFilename, destPath) {
  const src = path.join("public", "uploads", tempFilename).replace(/\\/g, "/");
  const dest = path.join("public", destPath).replace(/\\/g, "/");
  fs.renameSync(src, dest);
}
```

### Vi phạm 4: Multer storage config lặp lại 3 lần

```javascript
// Cấu hình storage giống hệt nhau xuất hiện ở:
// 1. routes/product.route.js (dòng ~1087)
// 2. routes/seller.route.js (dòng ~167)
// 3. routes/admin/product.route.js (dòng ~120)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
```

---

## 4. Vi phạm nguyên lý DRY (Don't Repeat Yourself)

> _"Mỗi phần knowledge nên có một đại diện duy nhất, rõ ràng trong hệ thống."_

### Vi phạm 1: Product Add Logic — Copy-Paste giữa Admin và Seller (NGHIÊM TRỌNG)

**File 1:** `routes/admin/product.route.js` POST `/add` (dòng 54-97)  
**File 2:** `routes/seller.route.js` POST `/products/add` (dòng 103-162)

Hai đoạn code gần như **GIỐNG NHAU 100%**:

| Bước                     | admin/product.route.js | seller.route.js      |
| ------------------------ | ---------------------- | -------------------- |
| Parse product body       | ✅ Giống               | ✅ Giống             |
| Build productData object | ✅ Giống (15 fields)   | ✅ Giống (15 fields) |
| Insert product           | ✅ Giống               | ✅ Giống             |
| Move thumbnail           | ✅ Giống               | ✅ Giống             |
| Move subimages           | ✅ Giống               | ✅ Giống             |
| Update DB paths          | ✅ Giống               | ✅ Giống             |

**Đề xuất sửa:** Tạo shared service:

```javascript
// services/product.service.js
export async function createProductWithImages(
  productData,
  thumbnailPath,
  imgsList,
) {
  const returnedID = await productModel.addProduct(productData);
  await moveAndSaveThumbnail(returnedID[0].id, thumbnailPath);
  await moveAndSaveSubimages(returnedID[0].id, imgsList);
  return returnedID[0].id;
}
```

### Vi phạm 2: Upload endpoints lặp 3 lần

```javascript
// 3 files có upload endpoints giống hệt nhau:
router.post(
  "/upload-thumbnail",
  upload.single("thumbnail"),
  async function (req, res) {
    res.json({ success: true, file: req.file });
  },
);
router.post(
  "/upload-subimages",
  upload.array("images", 10),
  async function (req, res) {
    res.json({ success: true, files: req.files });
  },
);
```

**Đề xuất sửa:** Tạo shared upload router:

```javascript
// routes/shared/upload.route.js
export function createUploadRoutes(upload) {
  const router = express.Router();
  router.post("/upload-thumbnail", upload.single("thumbnail"), (req, res) => {
    res.json({ success: true, file: req.file });
  });
  router.post("/upload-subimages", upload.array("images", 10), (req, res) => {
    res.json({ success: true, files: req.files });
  });
  return router;
}
```

### Vi phạm 3: OTP generation + sending lặp 5 lần

```javascript
// routes/account.route.js - Logic tạo và gửi OTP lặp ở:
// 1. POST /forgot-password (dòng 86-101)
// 2. POST /resend-forgot-password-otp (dòng 118-135)
// 3. POST /signin (chưa verify, dòng 187-203)
// 4. POST /signup (dòng 267-289)
// 5. POST /resend-otp (dòng 325-343)

// Mỗi lần đều lặp:
const otp = generateOtp();
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
await userModel.createOtp({
  user_id: user.id,
  otp_code: otp,
  purpose: "...",
  expires_at: expiresAt,
});
await sendMail({ to: email, subject: "...", html: `<p>OTP: ${otp}</p>` });
```

**Đề xuất sửa:**

```javascript
// services/otp.service.js
export async function generateAndSendOtp(user, purpose, emailSubject) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await userModel.createOtp({
    user_id: user.id,
    otp_code: otp,
    purpose,
    expires_at: expiresAt,
  });
  await sendMail({
    to: user.email,
    subject: emailSubject,
    html: getOtpEmailTemplate(user.fullname, otp),
  });
  return otp;
}
```

### Vi phạm 4: Bid count subquery lặp 15+ lần

```javascript
// Subquery đếm bid count xuất hiện ở HẦU HẾT các hàm trong product.model.js:
db.raw(
  `(SELECT COUNT(*) FROM bidding_history WHERE bidding_history.product_id = products.id) AS bid_count`,
);
```

Xuất hiện trong: `findAll`, `findByProductIdForAdmin`, `findPage`, `searchPageByKeywords`, `findByCategoryId`, `findByCategoryIds`, `findTopEnding`, `findTopBids`, `findByProductId`, `findByProductId2`, `findAllProductsBySellerId`, `findActiveProductsBySellerId`, `findPendingProductsBySellerId`, `findSoldProductsBySellerId`.

**Đề xuất sửa:**

```javascript
// models/product.model.js
const BID_COUNT_SUBQUERY = db.raw(`
  (SELECT COUNT(*) FROM bidding_history WHERE bidding_history.product_id = products.id) AS bid_count
`);

const MASKED_BIDDER_NAME = db.raw(
  `mask_name_alternating(users.fullname) AS bidder_name`,
);

const IS_FAVORITE_CHECK = db.raw(
  "watchlists.product_id IS NOT NULL AS is_favorite",
);
```

### Vi phạm 5: Flash message pattern lặp lại

```javascript
// Pattern lặp ở mọi route file:
const success_message = req.session.success_message;
const error_message = req.session.error_message;
delete req.session.success_message;
delete req.session.error_message;
```

**Đề xuất sửa:** Tạo middleware:

```javascript
// middlewares/flash.mdw.js
export function flashMessages(req, res, next) {
  res.locals.success_message = req.session.success_message;
  res.locals.error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;
  next();
}
```

### Vi phạm 6: `findByProductId` và `findByProductId2` gần giống nhau

```javascript
// product.model.js có 2 hàm findByProductId (dòng ~393) và findByProductId2 (dòng ~433)
// Cả hai đều: join products → users → product_images → categories
// Sự khác biệt chỉ là findByProductId2 thêm watchlist join và seller info
```

Tương tự, `findByProductIdForAdmin` cũng gần giống `findByProductId2`.

### Vi phạm 7: Rating page logic lặp cho Seller và Bidder

```javascript
// routes/product.route.js
// GET /seller/:sellerId/ratings (~30 dòng) và GET /bidder/:bidderId/ratings (~35 dòng)
// Logic gần giống nhau: get user → get rating → get reviews → calculate stats → render
```

### Vi phạm 8: `searchPageByKeywords` và `countByKeywords` lặp search logic

```javascript
// product.model.js - Cả 2 hàm đều lặp:
// 1. Remove accents logic (4 dòng giống nhau)
// 2. JOIN categories + parent_category
// 3. WHERE active products
// 4. WHERE search logic (AND/OR) — khoảng 20 dòng giống hệt
```

**Đề xuất sửa:** Tạo base query builder:

```javascript
function buildSearchQuery(keywords, logic) {
  const searchQuery = normalizeKeywords(keywords);
  return db('products')
    .leftJoin('categories', ...)
    .leftJoin('categories as parent_category', ...)
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at')
    .where((builder) => applyKeywordSearch(builder, searchQuery, logic));
}
```

### Vi phạm 9: Active products filter lặp

```javascript
// Điều kiện lọc sản phẩm active xuất hiện 10+ lần:
.where('products.end_at', '>', new Date())
.whereNull('products.closed_at')
```

**Đề xuất sửa:**

```javascript
function scopeActive(query) {
  return query
    .where("products.end_at", ">", new Date())
    .whereNull("products.closed_at");
}
```

### Vi phạm 10: Order Authorization Check lặp 8 lần

```javascript
// services/order.service.js — Xuất hiện ở: submitPayment, confirmPayment,
// submitShipping, confirmDelivery, submitRating, completeTransaction,
// sendMessage, getFormattedMessages
const order = await orderModel.findById(orderId);
if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
  throw new Error("Unauthorized");
}
// Hoặc biến thể buyer-only / seller-only:
if (!order || order.buyer_id !== userId) throw new Error("Unauthorized");
if (!order || order.seller_id !== userId) throw new Error("Unauthorized");
```

**Đề xuất sửa:**

```javascript
// services/order.service.js
async function getOrderWithAuth(orderId, userId, requiredRole = null) {
  const order = await orderModel.findById(orderId);
  if (!order) throw new Error("Order not found");
  if (requiredRole === "buyer" && order.buyer_id !== userId)
    throw new Error("Unauthorized");
  if (requiredRole === "seller" && order.seller_id !== userId)
    throw new Error("Unauthorized");
  if (!requiredRole && order.buyer_id !== userId && order.seller_id !== userId)
    throw new Error("Unauthorized");
  return order;
}
```

### Vi phạm 11: `postRateBidder`/`putRateBidder` và `postRateSeller`/`putRateSeller` gần giống nhau

```javascript
// controllers/seller.controller.js — postRateBidder (~L138) và putRateBidder (~L158)
// Cả hai ~18 dòng, logic giống nhau: extract params → validate → call
// ratingService.createOrUpdateReview → return JSON. Chỉ khác message.

// controllers/account.controller.js — postRateSeller (~L476) và putRateSeller (~L489)
// Tương tự: cùng logic, chỉ khác POST lấy seller_id từ body, PUT thì không.
```

**Đề xuất sửa:** Gộp thành một handler dùng chung cho POST và PUT, hoặc extract shared logic:

```javascript
async function handleRating(req, res, successMessage) {
  const { productId, rating, comment, revieweeId } = req.body;
  const reviewerId = req.session.authUser.id;
  await ratingService.createOrUpdateReview({
    reviewer_id: reviewerId,
    reviewed_user_id: revieweeId,
    product_id: productId,
    rating,
    comment,
  });
  res.json({ success: true, message: successMessage });
}
```

### Vi phạm 12: `submitRating` trong order.service.js trùng `createOrUpdateReview` trong rating.service.js

```javascript
// services/order.service.js — submitRating (~L200-L230)
// Re-implement lại logic create-or-update review thay vì gọi ratingService:
const existingReview = await reviewModel.findByReviewerAndProduct(
  reviewerId,
  productId,
);
if (existingReview) {
  await reviewModel.updateByReviewerAndProduct(reviewerId, productId, {
    rating,
    comment,
  });
} else {
  await reviewModel.create({
    reviewer_id,
    reviewed_user_id,
    product_id,
    rating,
    comment,
  });
}
// Logic này đã tồn tại trong ratingService.createOrUpdateReview()!
// Cũng lặp lại trong completeTransaction (~L241-265).
```

**Đề xuất sửa:** Gọi `ratingService.createOrUpdateReview()` thay vì tự implement lại.

### Vi phạm 13: `findByIdWithDetails` và `findByProductIdWithDetails` gần giống nhau

```javascript
// models/order.model.js
// findByIdWithDetails (~L72-96) và findByProductIdWithDetails (~L102-125)
// Cả hai có cùng 4 LEFT JOINs (products, buyer, seller, categories)
// và cùng 12+ SELECT columns. Chỉ khác WHERE clause:
// findByIdWithDetails:             .where('orders.id', orderId)
// findByProductIdWithDetails:      .where('orders.product_id', productId)
```

**Đề xuất sửa:**

```javascript
function buildOrderDetailsQuery() {
  return db("orders")
    .leftJoin("products", "orders.product_id", "products.id")
    .leftJoin("users as buyer", "orders.buyer_id", "buyer.id")
    .leftJoin("users as seller", "orders.seller_id", "seller.id")
    .leftJoin("categories", "products.category_id", "categories.id")
    .select(/* 12+ columns */);
}

export function findByIdWithDetails(orderId) {
  return buildOrderDetailsQuery().where("orders.id", orderId).first();
}

export function findByProductIdWithDetails(productId) {
  return buildOrderDetailsQuery().where("orders.product_id", productId).first();
}
```

### Vi phạm 14: JSON Error Response Pattern lặp 8+ lần

```javascript
// controllers/product.controller.js — Xuất hiện ở: postSubmitPayment,
// postConfirmPayment, postSubmitShipping, postConfirmDelivery, postSubmitRating,
// postCompleteTransaction, postSendMessage, getOrderMessages
} catch (error) {
  console.error('... error:', error);
  res.status(error.message === 'Unauthorized' ? 403 : 500)
    .json({ error: error.message || 'Failed to ...' });
}
```

**Đề xuất sửa:**

```javascript
// utils/asyncHandler.js
export function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch((error) => {
      console.error(error);
      const status = error.message === "Unauthorized" ? 403 : 500;
      res.status(status).json({ error: error.message });
    });
  };
}
```

### Vi phạm 15: Email HTML layout/footer lặp 10+ lần

```javascript
// Xuất hiện ở:
// - utils/bidNotification.js (4 templates)
// - utils/commentNotification.js (2 templates)
// - services/productDescription.service.js (~L76-92)
// - scripts/auctionEndNotifier.js (3 inline templates)
// - controllers/admin/user.controller.js (~L99-115)
//
// Tất cả share cùng wrapper HTML:
`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%);
    padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">...</h1>
  </div>
  ...
  <hr>
  <p style="color: #999; font-size: 0.8rem;">
    This is an automated message from Online Auction
  </p>
</div>`;
```

**Đề xuất sửa:**

```javascript
// utils/emailTemplates.js
export function emailLayout(headerTitle, bodyHtml, headerColor = "#72AEC8") {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, ${headerColor} 0%, ...); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0;">${headerTitle}</h1>
    </div>
    <div style="padding: 30px; background: #f9f9f9;">
      ${bodyHtml}
    </div>
    <hr>
    <p style="color: #999; font-size: 0.8rem;">
      This is an automated message from Online Auction
    </p>
  </div>`;
}
```

### Vi phạm 16: `normalizeSearchText` trùng lặp giữa model và service

```javascript
// models/product.model.js (~L4-10) và services/product.service.js (~L428-436)
// Hàm giống hệt nhau:
function normalizeSearchText(keywords) {
  return keywords
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}
```

**Đề xuất sửa:** Giữ ở một nơi duy nhất (ví dụ `utils/text.js`) rồi import.

### Vi phạm 17: `formatVND` / `Intl.NumberFormat` lặp 6+ lần

```javascript
// Mỗi file tự tạo riêng:
// - utils/bidNotification.js (~L14): const formatVND = (n) => new Intl.NumberFormat('en-US').format(n);
// - index.js (~L69): format_number helper
// - services/productDescription.service.js (~L82): inline format
// - scripts/auctionEndNotifier.js: 3 inline usages
```

**Đề xuất sửa:**

```javascript
// utils/format.js
export function formatVND(amount) {
  return new Intl.NumberFormat("en-US").format(amount);
}
```

### Vi phạm 18: Watchlist LEFT JOIN lặp 4 lần

```javascript
// models/product.model.js — Xuất hiện ở findByProductId (~L89),
// searchPageByKeywords (~L165), findByCategoryId (~L206), findByCategoryIds (~L252)
.leftJoin('watchlists', function() {
  this.on('products.id', '=', 'watchlists.product_id')
    .andOnVal('watchlists.user_id', '=', currentUserId || -1);
})
```

**Đề xuất sửa:**

```javascript
function scopeWatchlist(query, userId) {
  return query.leftJoin("watchlists", function () {
    this.on("products.id", "=", "watchlists.product_id").andOnVal(
      "watchlists.user_id",
      "=",
      userId || -1,
    );
  });
}
```

### Vi phạm 19: System Settings defaults lặp 3 lần

```javascript
// controllers/admin/system.controller.js — Object defaults lặp ở ~L5, ~L29, ~L47
const settings = {
  new_product_limit_minutes: 60,
  auto_extend_trigger_minutes: 5,
  auto_extend_duration_minutes: 10,
};
// Và array-to-object conversion loop cũng lặp 2 lần:
settingsArray.forEach((setting) => {
  settings[setting.key] = parseInt(setting.value);
});
```

**Đề xuất sửa:**

```javascript
const DEFAULT_SETTINGS = {
  new_product_limit_minutes: 60,
  auto_extend_trigger_minutes: 5,
  auto_extend_duration_minutes: 10,
};

async function getSettingsWithDefaults() {
  const settings = { ...DEFAULT_SETTINGS };
  const settingsArray = await systemSettingModel.findAll();
  settingsArray.forEach((s) => {
    settings[s.key] = parseInt(s.value);
  });
  return settings;
}
```

### Vi phạm 20: Product Status CASE SQL lặp 3 lần

```javascript
// models/product.model.js — findAllProductsBySellerId (~L473),
//   findExpiredProductsBySellerId (~L528)
// models/autoBidding.model.js — getWonAuctionsByBidderId (~L120)
//
// CASE WHEN is_sold IS TRUE THEN 'Sold'
//      WHEN is_sold IS FALSE THEN 'Cancelled'
//      WHEN end_at <= NOW() AND highest_bidder_id IS NOT NULL THEN 'Pending'
//      WHEN end_at <= NOW() AND highest_bidder_id IS NULL THEN 'Expired'
//      ELSE 'Active' END AS status
```

**Đề xuất sửa:**

```javascript
const PRODUCT_STATUS_CASE = db.raw(`
  CASE
    WHEN products.is_sold IS TRUE THEN 'Sold'
    WHEN products.is_sold IS FALSE THEN 'Cancelled'
    WHEN products.end_at <= NOW() AND products.highest_bidder_id IS NOT NULL THEN 'Pending'
    WHEN products.end_at <= NOW() AND products.highest_bidder_id IS NULL THEN 'Expired'
    ELSE 'Active'
  END AS status
`);
```

### Vi phạm 21: Review Rating Check Pattern lặp 3 lần

```javascript
// controllers/seller.controller.js — getSoldProducts (~L57), getExpiredProducts (~L72)
// controllers/account.controller.js — getAuctions (~L474)
const review = await reviewModel.getProductReview(userId, bidderId, product.id);
const hasActualReview = review && review.rating !== 0;
product.hasReview = hasActualReview;
product.reviewRating = hasActualReview
  ? review.rating === 1
    ? "positive"
    : "negative"
  : null;
product.reviewComment = hasActualReview ? review.comment : "";
```

**Đề xuất sửa:**

```javascript
// utils/reviewHelper.js
export async function enrichProductWithReview(product, reviewerId, revieweeId) {
  const review = await reviewModel.getProductReview(
    reviewerId,
    revieweeId,
    product.id,
  );
  const hasActualReview = review && review.rating !== 0;
  product.hasReview = hasActualReview;
  product.reviewRating = hasActualReview
    ? review.rating === 1
      ? "positive"
      : "negative"
    : null;
  product.reviewComment = hasActualReview ? review.comment : "";
  return product;
}
```

### Vi phạm 22: Gather bidders + commenters cho notification lặp 2 lần

```javascript
// utils/commentNotification.js (~L22-35) và
// services/productDescription.service.js (~L49-60)
const [bidders, commenters] = await Promise.all([
  biddingHistoryModel.getUniqueBidders(productId),
  productCommentModel.getUniqueCommenters(productId),
]);
const recipientsMap = new Map();
bidders.forEach((b) => {
  if (b.id !== sellerId) recipientsMap.set(b.id, b);
});
commenters.forEach((c) => {
  if (c.id !== sellerId) recipientsMap.set(c.id, c);
});
```

**Đề xuất sửa:**

```javascript
// utils/notificationHelper.js
export async function getProductNotificationRecipients(
  productId,
  excludeUserId,
) {
  const [bidders, commenters] = await Promise.all([
    biddingHistoryModel.getUniqueBidders(productId),
    productCommentModel.getUniqueCommenters(productId),
  ]);
  const recipientsMap = new Map();
  [...bidders, ...commenters].forEach((u) => {
    if (u.id !== excludeUserId) recipientsMap.set(u.id, u);
  });
  return Array.from(recipientsMap.values());
}
```

### Vi phạm 23: Seller Product List queries lặp 4 lần

```javascript
// models/product.model.js
// findActiveProductsBySellerId, findPendingProductsBySellerId,
// findSoldProductsBySellerId, findExpiredProductsBySellerId
// Tất cả bắt đầu với cùng base query:
db("products")
  .leftJoin("categories", "products.category_id", "categories.id")
  .where("seller_id", sellerId)
  .select("products.*", "categories.name as category_name", BID_COUNT_SUBQUERY);
// Chỉ khác nhau ở filter conditions
```

**Đề xuất sửa:**

```javascript
function buildSellerProductQuery(sellerId) {
  return db("products")
    .leftJoin("categories", "products.category_id", "categories.id")
    .where("seller_id", sellerId)
    .select(
      "products.*",
      "categories.name as category_name",
      BID_COUNT_SUBQUERY,
    );
}

export function findActiveProductsBySellerId(sellerId) {
  return buildSellerProductQuery(sellerId)
    .where("products.end_at", ">", new Date())
    .whereNull("products.closed_at");
}
// ... tương tự cho pending, sold, expired
```

### Vi phạm 24: Date formatting logic trùng

```javascript
// index.js — Handlebars helper format_date (~L96-106)
// services/order.service.js — formatMessagesHtml (~L303-310)
// Logic giống nhau:
const hour = String(d.getHours()).padStart(2, "0");
const minute = String(d.getMinutes()).padStart(2, "0");
const second = String(d.getSeconds()).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
const month = String(d.getMonth() + 1).padStart(2, "0");
const year = d.getFullYear();
return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
```

**Đề xuất sửa:**

```javascript
// utils/format.js
export function formatDateTime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
```

### Vi phạm 25: Category base query lặp 2 lần

```javascript
// models/category.model.js
// findByCategoryId (~L3-17) và findAll (~L33-45) dùng cùng base query:
db("categories as c")
  .leftJoin("categories as parent", "c.parent_id", "parent.id")
  .leftJoin("products as p", "c.id", "p.category_id")
  .select("c.id", "c.name", "c.parent_id", "parent.name as parent_name")
  .count("p.id as product_count")
  .groupBy("c.id", "c.name", "c.parent_id", "parent.name");
```

**Đề xuất sửa:**

```javascript
function baseCategoryQuery() {
  return db("categories as c")
    .leftJoin("categories as parent", "c.parent_id", "parent.id")
    .leftJoin("products as p", "c.id", "p.category_id")
    .select("c.id", "c.name", "c.parent_id", "parent.name as parent_name")
    .count("p.id as product_count")
    .groupBy("c.id", "c.name", "c.parent_id", "parent.name");
}
```

---

## 5. Vi phạm nguyên lý YAGNI (You Ain't Gonna Need It)

> _"Không triển khai tính năng cho đến khi thực sự cần."_

### Vi phạm 1: Dead code trong `GET /bid-history/:productId`

```javascript
// routes/product.route.js dòng ~858-885
router.get('/bid-history/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load bidding history' });
  }
  // ⚠️ CODE DƯỚI ĐÂY KHÔNG BAO GIỜ CHẠY (đã res.json rồi)!
  const result = await productModel.findByProductId(productId);
  const relatedProducts = await productModel.findRelatedProducts(productId);
  const product = { ... }; // ~20 dòng dead code
  res.render('vwProduct/details', { product });
});
```

### Vi phạm 2: Twitter OAuth Strategy commented out nhưng vẫn import

```javascript
// utils/passport.js
import { Strategy as TwitterStrategy } from "passport-twitter"; // Import nhưng không dùng
// Toàn bộ strategy bị comment out (~30 dòng)
```

### Vi phạm 3: Duplicate helper definitions trong `index.js`

```javascript
// index.js - Các helper bị khai báo 2 lần:
gte(a, b) { return a >= b; },  // dòng ~228
gte(a, b) { return a >= b; },  // dòng ~237

lte(a, b) { return a <= b; },  // dòng ~231
lte(a, b) { return a <= b; },  // dòng ~239

add(a, b) { return a + b; },   // dòng ~66
add(a, b) { return a + b; },   // dòng ~241
```

### Vi phạm 4: `systemSetting.model.js` có hàm không dùng

```javascript
export function editNewProductLimitMinutes(minutes) {
  // Hàm chuyên biệt này không được gọi từ đâu cả
  // vì admin/system.route.js dùng generic updateSetting() thay thế
}
```

### Vi phạm 5: `invoice.model.js` export nhiều hàm không sử dụng

- `deleteInvoice()` — không được gọi ở đâu
- `hasPaymentInvoice()` — không được gọi
- `hasShippingInvoice()` — không được gọi
- `getUnverifiedInvoices()` — không được gọi

### Vi phạm 6: Unused imports

```javascript
// index.js
import multer from "multer"; // Không sử dụng trong index.js
import { v4 as uuidv4 } from "uuid"; // Không sử dụng
```

---

## 6. Đề xuất Design Patterns

### 6.1. Service Layer Pattern (CẦN THIẾT NHẤT) ⭐

**Vấn đề:** Business logic nằm trong route handlers.  
**Giải pháp:** Tạo tầng service trung gian.

```
routes/ (Controller) → services/ (Business Logic) → models/ (Data Access)
```

**Services cần tạo:**

| File                          | Trách nhiệm                                        |
| ----------------------------- | -------------------------------------------------- |
| `services/bidding.service.js` | Auto-bidding, bid validation, buy-now              |
| `services/auth.service.js`    | Login, signup, OTP, password reset                 |
| `services/email.service.js`   | Email templates, email sending                     |
| `services/product.service.js` | Product CRUD, status determination, image handling |
| `services/order.service.js`   | Order workflow, payment, shipping                  |
| `services/rating.service.js`  | Rating logic, rating point calculation             |
| `services/upload.service.js`  | File upload, move, rename                          |

### 6.2. Strategy Pattern

**Áp dụng cho:**

- **Sorting:** Map sort option → query modifier (đã mô tả ở mục 2.2)
- **OAuth:** Generic handler cho các OAuth providers (đã mô tả ở mục 2.2)
- **Email templates:** Map event type → email template

```javascript
// services/email.service.js
const EMAIL_STRATEGIES = {
  bid_placed: (data) => ({
    subject: `New bid on ${data.productName}`,
    html: renderBidEmail(data),
  }),
  outbid: (data) => ({
    subject: `You've been outbid`,
    html: renderOutbidEmail(data),
  }),
  auction_won: (data) => ({
    subject: `Congratulations!`,
    html: renderWonEmail(data),
  }),
  // ...
};

export async function sendNotification(eventType, recipient, data) {
  const strategy = EMAIL_STRATEGIES[eventType];
  if (!strategy) return;
  const { subject, html } = strategy(data);
  await sendMail({ to: recipient, subject, html });
}
```

### 6.3. Repository Pattern

**Áp dụng cho:** Chuẩn hóa data access layer, tách biệt query building.

```javascript
// repositories/product.repository.js
class ProductRepository {
  baseQuery() {
    return db("products").leftJoin(
      "users",
      "products.highest_bidder_id",
      "users.id",
    );
  }

  withBidCount(query) {
    return query.select(BID_COUNT_SUBQUERY);
  }

  scopeActive(query) {
    return query
      .where("products.end_at", ">", new Date())
      .whereNull("products.closed_at");
  }

  withWatchlist(query, userId) {
    return query
      .leftJoin("watchlists", function () {
        this.on("products.id", "=", "watchlists.product_id").andOnVal(
          "watchlists.user_id",
          "=",
          userId || -1,
        );
      })
      .select(IS_FAVORITE_CHECK);
  }
}
```

### 6.4. Template Method Pattern

**Áp dụng cho:** Các CRUD routes trong admin có cấu trúc giống nhau (list, add, edit, delete).

### 6.5. Builder Pattern

**Áp dụng cho:** Xây dựng complex queries thay vì copy-paste.

```javascript
// Thay vì copy-paste query dài cho mỗi hàm find, dùng builder:
class ProductQueryBuilder {
  constructor() {
    this.query = db("products");
  }

  withSeller() {
    /* join seller */ return this;
  }
  withBidder() {
    /* join bidder */ return this;
  }
  withImages() {
    /* join images */ return this;
  }
  withWatchlist(userId) {
    /* join watchlist */ return this;
  }
  activeOnly() {
    /* where active */ return this;
  }
  withBidCount() {
    /* select bid_count */ return this;
  }

  build() {
    return this.query;
  }
}
```

### 6.6. Observer Pattern (Event-Driven)

**Áp dụng cho:** Tách email notifications ra khỏi business logic.

```javascript
// events/auctionEvents.js
import { EventEmitter } from "events";
export const auctionEvents = new EventEmitter();

// services/bidding.service.js
auctionEvents.emit("bid_placed", { product, bidder, newPrice });
auctionEvents.emit("outbid", { product, previousBidder, newPrice });
auctionEvents.emit("auction_won", { product, winner });

// listeners/emailListener.js
auctionEvents.on("bid_placed", async (data) => {
  await emailService.sendBidNotification(data);
});
```

### 6.7. Middleware Pattern (đã dùng nhưng chưa triệt để)

**Cần thêm:**

- Flash message middleware (thay vì lặp code)
- Input validation middleware (thay vì validate trong mỗi route)
- Error handling middleware (centralized)

---

## 7. Lộ trình Refactor

### Phase 1: Quick Wins (Ít rủi ro, tác động lớn)

| #   | Việc cần làm                                                         | Nguyên lý     | Ưu tiên       |
| --- | -------------------------------------------------------------------- | ------------- | ------------- |
| 1   | Fix `db.js` — dùng env vars, fix bug `post` → `port`                 | DIP, Security | 🔴 Cao        |
| 2   | Xóa dead code (bid-history route, duplicate helpers, unused imports) | YAGNI         | 🔴 Cao        |
| 3   | Tách Handlebars helpers ra file riêng                                | SRP           | 🟡 Trung bình |
| 4   | Tạo flash message middleware                                         | DRY           | 🟡 Trung bình |
| 5   | Extract constants (BID_COUNT_SUBQUERY, ACTIVE_SCOPE)                 | DRY           | 🟡 Trung bình |
| 6   | Tạo shared multer config                                             | DRY           | 🟢 Thấp       |

### Phase 2: Service Layer (Trọng tâm, nhiều effort)

| #   | Việc cần làm                                            | Nguyên lý | Ưu tiên       |
| --- | ------------------------------------------------------- | --------- | ------------- |
| 7   | Tạo `services/bidding.service.js` — tách logic đấu giá  | SRP, DIP  | 🔴 Cao        |
| 8   | Tạo `services/email.service.js` — tách email templates  | SRP, DRY  | 🔴 Cao        |
| 9   | Tạo `services/auth.service.js` — tách OTP, auth logic   | SRP, DRY  | 🟡 Trung bình |
| 10  | Tạo `services/product.service.js` — product CRUD shared | SRP, DRY  | 🟡 Trung bình |
| 11  | Tạo `services/order.service.js`                         | SRP       | 🟡 Trung bình |

### Phase 3: Architecture Improvement (Dài hạn)

| #   | Việc cần làm                                              | Nguyên lý     | Ưu tiên       |
| --- | --------------------------------------------------------- | ------------- | ------------- |
| 12  | Refactor `product.model.js` — dùng query builder pattern  | OCP, DRY, ISP | 🟡 Trung bình |
| 13  | Tách `product.route.js` thành nhiều sub-routers           | SRP           | 🟡 Trung bình |
| 14  | Tách `account.route.js` thành auth, profile, oauth routes | SRP           | 🟢 Thấp       |
| 15  | Refactor OAuth passport.js — generic handler              | OCP, DRY      | 🟢 Thấp       |
| 16  | Implement Event-Driven cho notifications                  | SRP, OCP      | 🟢 Thấp       |

---

## Tóm tắt

| Nguyên lý | Mức độ vi phạm  | Số lượng vi phạm | Ảnh hưởng                     |
| --------- | --------------- | ---------------- | ----------------------------- |
| **SRP**   | 🔴 Nghiêm trọng | 5 vi phạm chính  | Khó maintain, khó test        |
| **OCP**   | 🟡 Trung bình   | 3 vi phạm        | Khó mở rộng                   |
| **LSP**   | 🟢 Nhẹ          | 1 vi phạm        | API inconsistent              |
| **ISP**   | 🟡 Trung bình   | 1 vi phạm        | Import thừa                   |
| **DIP**   | 🔴 Nghiêm trọng | 3 vi phạm        | Security risk, tight coupling |
| **KISS**  | 🟡 Trung bình   | 4 vi phạm        | Khó đọc, khó debug            |
| **DRY**   | 🔴 Nghiêm trọng | 25 vi phạm       | Code duplication lớn          |
| **YAGNI** | 🟡 Trung bình   | 6 vi phạm        | Dead code, bloat              |

**Top 3 việc cần làm ngay:**

1. 🔴 Fix `db.js` (security + bug)
2. 🔴 Tạo Service Layer cho bidding & email
3. 🔴 Tách product route thành sub-modules + xóa dead code
