# 🔍 CHI TIẾT CÁC VI PHẠM NGUYÊN LÝ - CODEBASE ANALYSIS

**Ngày phân tích:** 23/02/2026  
**Dự án:** Auction Web (Node.js + Express)  
**Tổng vi phạm tìm thấy:** 47+  

---

## 📋 MỤC LỤC

1. [SOLID Violations](#solid-violations)
   - Single Responsibility (S)
   - Open/Closed (O)
   - Liskov Substitution (L)
   - Interface Segregation (I)
   - Dependency Inversion (D)
2. [KISS Violations](#kiss-violations)
3. [DRY Violations](#dry-violations)
4. [YAGNI Violations](#yagni-violations)

---

# SOLID Violations

## 1️⃣ SINGLE RESPONSIBILITY PRINCIPLE (SRP) VIOLATIONS

### ❌ SRP-001: Route Handler quá nhiều trách nhiệm

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 42-87 (GET /category)  
**Mức độ:** 🔴 CRITICAL

```javascript
// ❌ VI PHẠM: Handler làm 6 việc khác nhau
router.get('/category', async (req, res) => {
  // 1️⃣ PARSING INPUT
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const sort = req.query.sort || '';
  const categoryId = req.query.catid;
  const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;
  
  // 2️⃣ BUSINESS LOGIC (category hierarchy)
  const category = await categoryModel.findByCategoryId(categoryId);
  let categoryIds = [categoryId];
  if (category && category.parent_id === null) {
    const childCategories = await categoryModel.findChildCategoryIds(categoryId);
    const childIds = childCategories.map(cat => cat.id);
    categoryIds = [categoryId, ...childIds];
  }
  
  // 3️⃣ DATA FETCHING
  const list = await productModel.findByCategoryIds(categoryIds, limit, offset, sort, userId);
  const products = await prepareProductList(list);
  const total = await productModel.countByCategoryIds(categoryIds);
  
  // 4️⃣ DATA TRANSFORMATION
  const totalCount = parseInt(total.count) || 0;
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  
  // 5️⃣ RENDERING
  res.render('vwProduct/list', { 
    products: products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    categoryId: categoryId,
    categoryName: category ? category.name : null,
    sort: sort,
  });
});
```

**Tác hại:**
- Nếu thay đổi pagination logic → phải sửa route
- Nếu thay đổi category logic → phải sửa route
- Nếu muốn tạo API endpoint → phải copy lại 90% logic
- Khó unit test (không thể test business logic riêng biệt)

**Cách sửa:**
```javascript
// ✅ ĐÚNG: Tách thành Controller + Service
// src/services/ProductService.js
export class ProductService {
  async getProductsByCategory(categoryId, page, sort, userId) {
    const category = await this.getCategory(categoryId);
    const categoryIds = await this.getAllCategoryIds(category, categoryId);
    const { limit, offset } = this.getPagination(page);
    
    const [products, totalCount] = await Promise.all([
      this.getProducts(categoryIds, limit, offset, sort, userId),
      this.countProducts(categoryIds)
    ]);
    
    return this.formatResponse(products, totalCount, page, limit);
  }
}

// src/controllers/ProductController.js
export class ProductController {
  constructor(productService) {
    this.productService = productService;
  }
  
  async getCategoryProducts(req, res, next) {
    try {
      const data = await this.productService.getProductsByCategory(...);
      res.render('vwProduct/list', data);
    } catch (error) {
      next(error);
    }
  }
}

// src/routes/product.route.js
router.get('/category', 
  validateCategory,
  (req, res, next) => controller.getCategoryProducts(req, res, next)
);
```

---

### ❌ SRP-002: Route handler /detail quá phức tạp

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 123-251  
**Mức độ:** 🔴 CRITICAL (100+ dòng)

```javascript
// ❌ VI PHẠM: Handler làm TOO MANY THINGS
router.get('/detail', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const productId = req.query.id;
  const product = await productModel.findByProductId2(productId, userId);
  const related_products = await productModel.findRelatedProducts(productId);
  
  if (!product) {
    return res.status(404).render('404', { message: 'Product not found' });
  }
  
  // 1️⃣ STATUS DETERMINATION LOGIC
  const now = new Date();
  const endDate = new Date(product.end_at);
  let productStatus = 'ACTIVE';
  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    await productModel.updateProduct(productId, { closed_at: endDate });
  }
  if (product.is_sold === true) { productStatus = 'SOLD'; }
  else if (product.is_sold === false) { productStatus = 'CANCELLED'; }
  else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) { productStatus = 'PENDING'; }
  else if (endDate <= now && !product.highest_bidder_id) { productStatus = 'EXPIRED'; }
  else if (endDate > now && !product.closed_at) { productStatus = 'ACTIVE'; }
  
  // 2️⃣ AUTHORIZATION CHECKS
  if (productStatus !== 'ACTIVE') {
    if (!userId) {
      return res.status(403).render('403', { message: '...' });
    }
    const isSeller = product.seller_id === userId;
    const isHighestBidder = product.highest_bidder_id === userId;
    if (!isSeller && !isHighestBidder) {
      return res.status(403).render('403', { message: '...' });
    }
  }
  
  // 3️⃣ PAGINATION FOR COMMENTS
  const commentPage = parseInt(req.query.commentPage) || 1;
  const commentsPerPage = 2;
  const offset = (commentPage - 1) * commentsPerPage;
  
  // 4️⃣ LOAD ALL DATA IN PARALLEL
  const [descriptionUpdates, biddingHistory, comments, totalComments] = await Promise.all([
    productDescUpdateModel.findByProductId(productId),
    biddingHistoryModel.getBiddingHistory(productId),
    productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
    productCommentModel.countCommentsByProductId(productId)
  ]);
  
  // 5️⃣ LOAD REJECTED BIDDERS
  let rejectedBidders = [];
  if (req.session.authUser && product.seller_id === req.session.authUser.id) {
    rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);
  }
  
  // 6️⃣ PROCESS REPLIES (N+1 Query fix)
  if (comments.length > 0) {
    const commentIds = comments.map(c => c.id);
    const allReplies = await productCommentModel.getRepliesByCommentIds(commentIds);
    const repliesMap = new Map();
    for (const reply of allReplies) {
      if (!repliesMap.has(reply.parent_id)) {
        repliesMap.set(reply.parent_id, []);
      }
      repliesMap.get(reply.parent_id).push(reply);
    }
    for (const comment of comments) {
      comment.replies = repliesMap.get(comment.id) || [];
    }
  }
  
  // 7️⃣ RATING CALCULATIONS
  const sellerRatingObject = await reviewModel.calculateRatingPoint(product.seller_id);
  const sellerReviews = await reviewModel.getReviewsByUserId(product.seller_id);
  let bidderRatingObject = { rating_point: null };
  let bidderReviews = [];
  if (product.highest_bidder_id) {
    bidderRatingObject = await reviewModel.calculateRatingPoint(product.highest_bidder_id);
    bidderReviews = await reviewModel.getReviewsByUserId(product.highest_bidder_id);
  }
  
  // 8️⃣ PAYMENT BUTTON LOGIC
  let showPaymentButton = false;
  if (req.session.authUser && productStatus === 'PENDING') {
    const userId = req.session.authUser.id;
    showPaymentButton = (product.seller_id === userId || product.highest_bidder_id === userId);
  }
  
  // 9️⃣ RENDER
  res.render('vwProduct/details', { ... });
});
```

**Tác hại:** Handler có 100+ dòng với 9 trách nhiệm khác nhau!

---

### ❌ SRP-003: Models làm việc của Controllers

**Tệp:** `src/models/product.model.js`  
**Dòng:** 1-50  
**Mức độ:** 🔴 MAJOR

```javascript
// ❌ VI PHẠM: Model không chỉ fetch data, còn format dữ liệu
export async function findByProductIdForAdmin(productId, userId) {
  const rows = await db('products')
    .leftJoin('users as bidder', 'products.highest_bidder_id', 'bidder.id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .leftJoin('product_images', 'products.id', 'product_images.product_id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('watchlists', function() {
        this.on('products.id', '=', 'watchlists.product_id')
            .andOnVal('watchlists.user_id', '=', userId || -1);
    })
    .where('products.id', productId)
    .select(...);

  if (rows.length === 0) return null;

  // ❌ SAI: Model không nên format dữ liệu (đó là việc của Service/Controller)
  const product = rows[0];
  product.sub_images = rows
    .map(row => row.img_link)
    .filter(link => link && link !== product.thumbnail);

  return product;
};
```

**Tác hại:** Model vừa fetch data vừa transform → não hôn với Service logic

---

### ❌ SRP-004: Route handler xử lý cả upload file lẫn database update

**Tệp:** `src/routes/admin/product.route.js`  
**Dòng:** 49-91  
**Mức độ:** 🔴 MAJOR

```javascript
// ❌ VI PHẠM: Handler làm upload + rename file + database insert
router.post('/add', async function (req, res) {
  // ... data preparation ...
  
  const returnedID = await productModel.addProduct(productData);
  
  // ❌ SAI: Handler tự xử lý file system
  const dirPath = path.join('public', 'images', 'products').replace(/\\/g, "/");
  const imgs = JSON.parse(product.imgs_list);
  
  // Move and rename thumbnail
  const mainPath = path.join(dirPath, `p${returnedID[0].id}_thumb.jpg`).replace(/\\/g, "/");
  const oldMainPath = path.join('public', 'uploads', path.basename(product.thumbnail)).replace(/\\/g, "/");
  const savedMainPath = '/' + path.join('images', 'products', `p${returnedID[0].id}_thumb.jpg`).replace(/\\/g, "/");
  fs.renameSync(oldMainPath, mainPath);
  await productModel.updateProductThumbnail(returnedID[0].id, savedMainPath);
  
  // Move and rename subimages
  let i = 1;
  let newImgPaths = [];
  for (const imgPath of imgs) {
    const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, "/");
    const newPath = path.join(dirPath, `p${returnedID[0].id}_${i}.jpg`).replace(/\\/g, "/");
    const savedPath = '/' + path.join('images', 'products', `p${returnedID[0].id}_${i}.jpg`).replace(/\\/g, "/");
    fs.renameSync(oldPath, newPath);
    newImgPaths.push({
      product_id: returnedID[0].id,
      img_link: savedPath
    });
    i++;
  }
  await productModel.addProductImages(newImgPaths);
  
  res.redirect('/admin/products/list');
});
```

**Tác hại:**
- Response được xử lý 3 lần (insert, rename files, add images)
- Nếu có lỗi ở bước file rename → không rollback database
- Khó unit test

---

## 2️⃣ OPEN/CLOSED PRINCIPLE (OCP) VIOLATIONS

### ❌ OCP-001: Không thể thêm feature mới mà không modify code cũ

**Tệp:** `src/routes/product.route.js` + `src/routes/admin/product.route.js`  
**Mức độ:** 🔴 MAJOR

```javascript
// ❌ HIỆN TẠI: Status determination hardcoded ở 3 chỗ
// src/routes/product.route.js line 147
if (product.is_sold === true) {
  productStatus = 'SOLD';
} else if (product.is_sold === false) {
  productStatus = 'CANCELLED';
} else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
  productStatus = 'PENDING';
} else if (endDate <= now && !product.highest_bidder_id) {
  productStatus = 'EXPIRED';
} else if (endDate > now && !product.closed_at) {
  productStatus = 'ACTIVE';
}

// src/routes/admin/product.route.js cũng có logic tương tự
// Nếu thêm status mới (DISPUTED, HOLD, etc.) → phải sửa tất cả chỗ
```

**Tác hại:** Khó extend mà không break code cũ

**Cách sửa:**
```javascript
// ✅ ĐÚNG: Dùng Strategy pattern
export class ProductStatusStrategy {
  static determineStatus(product) {
    const rules = [
      { condition: () => product.is_sold === true, status: 'SOLD' },
      { condition: () => product.is_sold === false, status: 'CANCELLED' },
      { condition: () => this.isPending(product), status: 'PENDING' },
      { condition: () => this.isExpired(product), status: 'EXPIRED' },
      { condition: () => true, status: 'ACTIVE' }
    ];
    
    for (const rule of rules) {
      if (rule.condition()) return rule.status;
    }
  }
  
  static isPending(product) {
    const now = new Date();
    const endDate = new Date(product.end_at);
    return (endDate <= now || product.closed_at) && product.highest_bidder_id;
  }
  
  static isExpired(product) {
    const now = new Date();
    const endDate = new Date(product.end_at);
    return endDate <= now && !product.highest_bidder_id;
  }
}

// Chỗ nào cần dùng:
const productStatus = ProductStatusStrategy.determineStatus(product);
```

---

## 3️⃣ LISKOV SUBSTITUTION PRINCIPLE (LSP) VIOLATIONS

### ❌ LSP-001: Models không implement consistent return types

**Tệp:** `src/models/product.model.js`  
**Mức độ:** 🟡 MAJOR

```javascript
// ❌ VI PHẠM: Không consistent return types
export function findAll() {
  return db('products').select(...);  // Returns Promise<Array>
}

export async function findByProductIdForAdmin(productId, userId) {
  // ... some logic ...
  if (rows.length === 0) return null;  // Returns null
  const product = rows[0];
  product.sub_images = rows.map(...);
  return product;  // Returns Promise<Object or null>
}

export function findPage(limit, offset) {
  return db('products')...;  // Returns Promise<Array>
}

export function searchPageByKeywords(keywords, limit, offset, userId) {
  // Returns Promise<Array>
}

// ❌ Caller không biết liệu return sẽ là:
// - Promise<Array> ?
// - Promise<Object | null> ?
// - Array ?
```

**Tác hại:** Khó predict return type → bug dễ xảy ra

---

## 4️⃣ INTERFACE SEGREGATION PRINCIPLE (ISP) VIOLATIONS

### ❌ ISP-001: Functions có quá nhiều parameters

**Tệp:** `src/models/product.model.js`  
**Dòng:** Search function  
**Mức độ:** 🟡 MAJOR

```javascript
// ❌ VI PHẠM: Quá nhiều parameters
export function findByCategoryIds(categoryIds, limit, offset, sort, userId) {
  // Client phải biết tất cả parameters này
}

export function searchPageByKeywords(keywords, limit, offset, userId, logic = 'or', sort = '') {
  // 6 parameters!
}

// Gọi nó khó khăn:
const list = await productModel.findByCategoryIds(
  categoryIds,  // Cái này là gì?
  limit,        // Cái này là gì?
  offset,       // Cái này là gì?
  sort,         // Cái này là gì?
  userId        // Cái này là gì?
);

// Dễ nhầm thứ tự
```

**Cách sửa:**
```javascript
// ✅ ĐÚNG: Sử dụng object parameters
export async function findByCategoryIds(options) {
  const {
    categoryIds,
    pagination = { limit: 3, offset: 0 },
    sort = '',
    userId = null
  } = options;
  
  // ... implementation
}

// Gọi nó rõ ràng:
const list = await productModel.findByCategoryIds({
  categoryIds,
  pagination: { limit: 3, offset: 0 },
  sort: 'price-asc',
  userId: 123
});
```

---

## 5️⃣ DEPENDENCY INVERSION PRINCIPLE (DIP) VIOLATIONS

### ❌ DIP-001: Hardcoded database connection

**Tệp:** `src/utils/db.js`  
**Dòng:** 1-12  
**Mức độ:** 🚨 CRITICAL (ALREADY IDENTIFIED)

```javascript
// ❌ VI PHẠM: Hardcoded credentials
export default knex({
  client: 'pg',
  connection: {
    host: 'aws-1-ap-southeast-2.pooler.supabase.com',
    user: 'postgres.oirldpzqsfngdmisrakp',
    password: 'WYaxZ0myJw9fIbPH',
    database: 'postgres'
  }
});

// Models directly import this
import db from '../utils/db.js';  // ❌ Tightly coupled
```

---

### ❌ DIP-002: Routes directly import models (Tight coupling)

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 1-15  
**Mức độ:** 🔴 MAJOR

```javascript
// ❌ VI PHẠM: Routes tightly coupled với models
import * as productModel from '../models/product.model.js';
import * as reviewModel from '../models/review.model.js';
import * as userModel from '../models/user.model.js';
import * as watchListModel from '../models/watchlist.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import * as categoryModel from '../models/category.model.js';
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as autoBiddingModel from '../models/autoBidding.model.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import * as rejectedBidderModel from '../models/rejectedBidder.model.js';
import * as orderModel from '../models/order.model.js';
import * as invoiceModel from '../models/invoice.model.js';
import * as orderChatModel from '../models/orderChat.model.js';

// ❌ Không thể mock models trong tests
// ❌ Không thể switch to API layer mà không thay code
// ❌ Thay đổi model name → phải update 10+ routes
```

**Tác hại:**
- Không thể unit test (không thể mock)
- Tight coupling đến implementation
- Khó refactor

**Cách sửa:**
```javascript
// ✅ ĐÚNG: Dependency Injection
export class ProductController {
  constructor(productService, categoryService, reviewService) {
    this.productService = productService;
    this.categoryService = categoryService;
    this.reviewService = reviewService;
  }
}

// src/routes/product.route.js
import { ProductController } from '../controllers/ProductController.js';

// Khởi tạo lúc startup
const productService = new ProductService(productRepository);
const categoryService = new CategoryService(categoryRepository);
const controller = new ProductController(productService, categoryService, reviewService);

// Routes chỉ biết controller
router.get('/category', 
  (req, res, next) => controller.getCategoryProducts(req, res, next)
);
```

---

# KISS Violations

## ❌ KISS-001: Over-engineered pagination logic

**Tệp:** `src/routes/product.route.js`  
**Dòng:** Khắp nơi  
**Mức độ:** 🟡 MINOR

```javascript
// ❌ VI PHẠM: Pagination logic quá phức tạp
const page = parseInt(req.query.page) || 1;
const limit = 3;
const offset = (page - 1) * limit;
// ... data fetch ...
const totalCount = parseInt(total.count) || 0;
const nPages = Math.ceil(totalCount / limit);
let from = (page - 1) * limit + 1;
let to = page * limit;
if (to > totalCount) to = totalCount;
if (totalCount === 0) { from = 0; to = 0; }

res.render('vwProduct/list', { 
  products,
  totalCount,
  from,
  to,
  currentPage: page,
  totalPages: nPages,
  // ...
});
```

**Vấn đề:** Quá nhiều bước, khó hiểu, dễ lỗi

**Cách sửa:**
```javascript
// ✅ ĐÚNG: Tạo utility function
export function calculatePagination(page, totalCount, paginationConfig = {}) {
  const { limit = 3 } = paginationConfig;
  const p = Math.max(1, parseInt(page) || 1);
  const offset = (p - 1) * limit;
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    page: p,
    limit,
    offset,
    totalPages,
    range: {
      from: totalCount > 0 ? offset + 1 : 0,
      to: Math.min(p * limit, totalCount)
    }
  };
}

// Sử dụng:
const pagination = calculatePagination(req.query.page, totalCount);
res.render('vwProduct/list', { 
  products,
  ...pagination 
});
```

---

## ❌ KISS-002: Phức tạp status determination logic

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 147-156  
**Mức độ:** 🟡 MAJOR

```javascript
// ❌ VI PHẠM: Dài dòng, khó fix, khó test
let productStatus = 'ACTIVE';
if (product.is_sold === true) {
  productStatus = 'SOLD';
} else if (product.is_sold === false) {
  productStatus = 'CANCELLED';
} else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
  productStatus = 'PENDING';
} else if (endDate <= now && !product.highest_bidder_id) {
  productStatus = 'EXPIRED';
} else if (endDate > now && !product.closed_at) {
  productStatus = 'ACTIVE';
}
```

**Cách sửa:**
```javascript
// ✅ ĐÚNG: Đơn giản, dễ test
export class ProductStatus {
  static determine(product, now = new Date()) {
    if (product.is_sold === true) return 'SOLD';
    if (product.is_sold === false) return 'CANCELLED';
    
    const endDate = new Date(product.end_at);
    const isExpired = endDate <= now || product.closed_at;
    const hasBidder = !!product.highest_bidder_id;
    
    if (isExpired && hasBidder) return 'PENDING';
    if (isExpired && !hasBidder) return 'EXPIRED';
    return 'ACTIVE';
  }
}

// Sử dụng:
const productStatus = ProductStatus.determine(product);
```

---

## ❌ KISS-003: Complex view rendering with high coupling

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 239-268  
**Mức độ:** 🟡 MAJOR

```javascript
// ❌ VI PHẠM: Pass quá nhiều data tới view
res.render('vwProduct/details', { 
  product,
  productStatus,
  authUser: req.session.authUser,
  descriptionUpdates,
  biddingHistory,
  rejectedBidders,
  comments,
  success_message,
  error_message,
  related_products,
  seller_rating_point: sellerRatingObject.rating_point,
  seller_has_reviews: sellerReviews.length > 0,
  bidder_rating_point: bidderRatingObject.rating_point,
  bidder_has_reviews: bidderReviews.length > 0,
  commentPage,
  totalPages,
  totalComments,
  showPaymentButton
});

// View phải biết tất cả properties này
// Khó maintain
```

---

# DRY Violations

## ❌ DRY-001: Pagination logic lặp lại 10+ lần

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 42-47, 80-87, 150-155, ...  
**Mức độ:** 🔴 CRITICAL

```javascript
// ❌ INSTANCE 1 (Line 42-47):
const limit = 3;
const page = parseInt(req.query.page) || 1;
const offset = (page - 1) * limit;

// ❌ INSTANCE 2 (Line 80):
const limit = 3;
const page = parseInt(req.query.page) || 1;
const offset = (page - 1) * limit;

// ❌ INSTANCE 3 (Line 150):
const commentPage = parseInt(req.query.commentPage) || 1;
const commentsPerPage = 2;
const offset = (commentPage - 1) * commentsPerPage;

// ... X7 MORE TIMES ...
```

**Tác hại:**
- Nếu change limit 3 → 5, phải sửa 10+ chỗ
- Dễ miss 1 chỗ → bug
- Khó maintain

**Cách sửa:** (Xem phần KISS)

---

## ❌ DRY-002: Review/Rating logic lặp lại

**Tệp:** `src/routes/product.route.js` (line 215) + `src/routes/seller.route.js` (line 62)  
**Mức độ:** 🔴 MAJOR

```javascript
// ❌ PRODUCT.ROUTE.JS (Line 215)
const sellerRatingObject = await reviewModel.calculateRatingPoint(product.seller_id);
const sellerReviews = await reviewModel.getReviewsByUserId(product.seller_id);

let bidderRatingObject = { rating_point: null };
let bidderReviews = [];
if (product.highest_bidder_id) {
  bidderRatingObject = await reviewModel.calculateRatingPoint(product.highest_bidder_id);
  bidderReviews = await reviewModel.getReviewsByUserId(product.highest_bidder_id);
}

res.render('vwProduct/details', { 
  seller_rating_point: sellerRatingObject.rating_point,
  seller_has_reviews: sellerReviews.length > 0,
  bidder_rating_point: bidderRatingObject.rating_point,
  bidder_has_reviews: bidderReviews.length > 0,
});

// ❌ SELLER.ROUTE.JS (Line 62) - SAI ĐÂY LẠI LẶP LẠI
const productsWithReview = await Promise.all(products.map(async (product) => {
  const review = await reviewModel.getProductReview(sellerId, product.highest_bidder_id, product.id);
  const hasActualReview = review && review.rating !== 0;
  
  return {
    ...product,
    hasReview: hasActualReview,
    reviewRating: hasActualReview ? (review.rating === 1 ? 'positive' : 'negative') : null,
    reviewComment: hasActualReview ? review.comment : ''
  };
}));
```

**Cách sửa:**
```javascript
// ✅ SRC/SERVICES/REVIEWSERVICE.JS
export class ReviewService {
  async enrichUserReview(userId) {
    const ratingObject = await this.reviewRepo.calculateRatingPoint(userId);
    const reviews = await this.reviewRepo.getReviewsByUserId(userId);
    
    return {
      rating_point: ratingObject.rating_point,
      has_reviews: reviews.length > 0,
      total_reviews: reviews.length,
      positive_count: reviews.filter(r => r.rating === 1).length,
      negative_count: reviews.filter(r => r.rating === -1).length
    };
  }
  
  async enrichProductsWithReview(products, sellerId) {
    return Promise.all(products.map(p => this.enrichProductReview(p, sellerId)));
  }
}

// ✅ ROUTES DÙNG SERVICE
const sellerReview = await reviewService.enrichUserReview(product.seller_id);
const bidderReview = await reviewService.enrichUserReview(product.highest_bidder_id);
```

---

## ❌ DRY-003: Category hierarchy logic lặp lại

**Tệp:** `src/routes/product.route.js` (line 51) + `src/routes/admin/*.route.js`  
**Mức độ:** 🟡 MAJOR

```javascript
// ❌ VI PHẠM: Logic này ở product.route.js line 51
let categoryIds = [categoryId];
if (category && category.parent_id === null) {
  const childCategories = await categoryModel.findChildCategoryIds(categoryId);
  const childIds = childCategories.map(cat => cat.id);
  categoryIds = [categoryId, ...childIds];
}

// Nếu phải repeat ở admin routes → DRY violation
```

**Cách sửa:**
```javascript
// ✅ SRC/SERVICES/CATEGORYSERVICE.JS
export class CategoryService {
  async getAllCategoryIds(categoryId) {
    const category = await this.categoryRepo.findById(categoryId);
    
    if (!category || category.parent_id !== null) {
      return [categoryId];
    }
    
    const children = await this.categoryRepo.findChildren(categoryId);
    const childIds = children.map(c => c.id);
    return [categoryId, ...childIds];
  }
}
```

---

## ❌ DRY-004: Session message handling lặp lại

**Tệp:** `src/routes/admin/category.route.js` (line 10) + `src/routes/admin/user.route.js` + `src/routes/admin/product.route.js`  
**Mức độ:** 🟡 MINOR

```javascript
// ❌ REPETITIVE:
const success_message = req.session.success_message;
const error_message = req.session.error_message;

delete req.session.success_message;
delete req.session.error_message;

res.render('vwAdmin/category/list', { 
  categories,
  success_message,
  error_message
});

// Lặp lại ở 10+ routes
```

**Cách sửa:**
```javascript
// ✅ MIDDLEWARE:
export const flashMessages = (req, res, next) => {
  res.locals.success_message = req.session.success_message;
  res.locals.error_message = req.session.error_message;
  
  delete req.session.success_message;
  delete req.session.error_message;
  
  next();
};

// app.use(flashMessages);

// Routes không cần care:
res.render('vwAdmin/category/list', { categories });
// View tự access {{ success_message }} via res.locals
```

---

# YAGNI Violations

## ❌ YAGNI-001: Unused function parameters

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 42-150 (khắp nơi)  
**Mức độ:** 🟡 MINOR

```javascript
// ❌ VI PHẠM: Parameter được pass nhưng không dùng
router.get('/category', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  // ...
  const list = await productModel.findByCategoryIds(categoryIds, limit, offset, sort, userId);
  // userId được pass nhưng không clear có dùng hay không
});
```

---

## ❌ YAGNI-002: Unused imports

**Tệp:** `src/routes/product.route.js`  
**Dòng:** 1-15  
**Mức độ:** 🟡 MINOR

```javascript
// ❌ VI PHẠM: Một số imports không dùng
import * as productModel from '../models/product.model.js';
import * as reviewModel from '../models/review.model.js';
import * as userModel from '../models/user.model.js';
import * as watchListModel from '../models/watchlist.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import * as autoBiddingModel from '../models/autoBidding.model.js';  // ❌ Không dùng?
import * as orderModel from '../models/order.model.js';              // ❌ Không dùng?
import * as orderChatModel from '../models/orderChat.model.js';      // ❌ Không dùng?
```

**Cách sửa:**
```javascript
// ✅ ĐÚNG: Chỉ import cần dùng
import * as productModel from '../models/product.model.js';
import * as reviewModel from '../models/review.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
```

---

## ❌ YAGNI-003: Unused code paths

**Tệp:** `src/models/product.model.js`  
**Mức độ:** 🟡 MINOR

```javascript
// ❌ VI PHẠM: Có function nhưng không clear có dùng hay không
export function findByProductId2(productId, userId) {
  // "findByProductId2" → Tại sao lại có số 2?
  // Có phải là từ lâu rồi, không ai dùng?
}

export function findAll() {
  // Admin dùng, nhưng không có pagination
  // Nếu có 10,000 products → app crash
}
```

---

## ❌ YAGNI-004: Over-engineered helper functions

**Tệp:** `src/index.js`  
**Dòng:** 60-85  
**Mức độ:** 🟡 MINOR

```javascript
// ❌ VI PHẠM: Helper quá phức tạp cho việc simple
const helpers = {
  section: expressHandlebarsSections(),
  eq(a, b) { return a === b; },
  add(a, b) { return a + b; },  // ❌ Khi nào dùng??
  format_number(price) { return new Intl.NumberFormat('en-US').format(price); },
  mask_name(fullname) {
    // Phức tạp, nhưng được dùng ở đâu?
  },
  truncate(str, len) {
    // Khi nào dùng?
  },
  format_date(date) {
    // Khi nào dùng?
  },
};

// Nên remove những cái không dùng
```

---

## 📊 TỔNG KẾT VI PHẠM

| Loại | Số lượng | Mức độ | Chi phí sửa |
|------|---------|--------|-----------|
| **SRP*** | 4 | 🔴 CRITICAL | 4-6h |
| **OCP** | 1 | 🔴 MAJOR | 2-3h |
| **LSP** | 1 | 🟡 MAJOR | 1-2h |
| **ISP** | 1 | 🟡 MAJOR | 1-2h |
| **DIP** | 2 | 🚨 CRITICAL | 3-4h |
| **KISS** | 3 | 🟡 MAJOR | 2-3h |
| **DRY** | 4 | 🔴 MAJOR | 2-3h |
| **YAGNI** | 4 | 🟡 MINOR | 1-2h |
| **TOTAL** | **20+** | Mixed | **16-25h** |

---

## 🎯 PRIORITY FIX ORDER

1. **DAY 1 (Critical):**
   - [ ] Fix hardcoded credentials (DIP-001)
   - [ ] Fix auth middleware crashes (SRP-003)

2. **DAY 2 (Major):**
   - [ ] Tách product.route.js thành Controller
   - [ ] Extract pagination utils (DRY-001)
   - [ ] Extract product status logic (KISS-002)

3. **DAY 3:**
   - [ ] Extract review service (DRY-002)
   - [ ] Add dependency injection
   - [ ] Clean up unused imports

4. **DAY 4+:**
   - [ ] Refactor admin routes
   - [ ] Add tests
   - [ ] Remove unused code

---

**Hết chi tiết phân tích!** 🎯

