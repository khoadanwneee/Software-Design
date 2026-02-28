import db from '../utils/db.js';
import { normalizeSearchText } from '../utils/text.js';

// ============ REUSABLE QUERY FRAGMENTS ============

const BID_COUNT_SUBQUERY = db.raw(
  '(SELECT COUNT(*) FROM bidding_history WHERE bidding_history.product_id = products.id) AS bid_count'
);

const MASKED_BIDDER_NAME = db.raw(
  'mask_name_alternating(users.fullname) AS bidder_name'
);

const IS_FAVORITE_CHECK = db.raw(
  'watchlists.product_id IS NOT NULL AS is_favorite'
);

export const PRODUCT_STATUS_CASE = db.raw(`
  CASE
    WHEN products.is_sold IS TRUE THEN 'Sold'
    WHEN products.is_sold IS FALSE THEN 'Cancelled'
    WHEN (products.end_at <= NOW() OR products.closed_at IS NOT NULL) AND products.highest_bidder_id IS NOT NULL AND products.is_sold IS NULL THEN 'Pending'
    WHEN products.end_at <= NOW() AND products.highest_bidder_id IS NULL THEN 'No Bidders'
    WHEN products.end_at > NOW() AND products.closed_at IS NULL THEN 'Active'
  END AS status
`);

const BIDS_SUM_SUBQUERY = db.raw(`
  COALESCE(SUM((
    SELECT COUNT(*)
    FROM bidding_history
    WHERE bidding_history.product_id = products.id
  )), 0) as total_bids
`);

// ============ SORT STRATEGY (DRY fix: replaces duplicated if-else chains) ============

const SORT_STRATEGIES = {
  price_asc:  { column: 'products.current_price', order: 'asc' },
  price_desc: { column: 'products.current_price', order: 'desc' },
  newest:     { column: 'products.created_at',     order: 'desc' },
  oldest:     { column: 'products.created_at',     order: 'asc' },
};

function applySorting(query, sort, defaultColumn = 'products.created_at', defaultOrder = 'desc') {
  const strategy = SORT_STRATEGIES[sort];
  if (strategy) {
    return query.orderBy(strategy.column, strategy.order);
  }
  return query.orderBy(defaultColumn, defaultOrder);
}

// ============ REUSABLE SCOPES ============

function scopeActive(query) {
  return query
    .where('products.end_at', '>', new Date())
    .whereNull('products.closed_at');
}

function scopeWatchlist(query, userId) {
  return query.leftJoin('watchlists', function() {
    this.on('products.id', '=', 'watchlists.product_id')
      .andOnVal('watchlists.user_id', '=', userId || -1);
  });
}

// ============ SELLER SCOPES (DRY fix: replaces 5 duplicated count/find functions) ============

const SELLER_SCOPES = {
  active: (q) => q.where('end_at', '>', new Date()).whereNull('closed_at'),
  sold: (q) => q.where('end_at', '<=', new Date()).where('is_sold', true),
  pending: (q) => q
    .where(function() {
      this.where('end_at', '<=', new Date()).orWhereNotNull('closed_at');
    })
    .whereNotNull('highest_bidder_id')
    .whereNull('is_sold'),
  expired: (q) => q
    .where(function() {
      this.where(function() {
        this.where('end_at', '<=', new Date()).whereNull('highest_bidder_id');
      }).orWhere('is_sold', false);
    }),
};

function countBySellerScope(sellerId, scope) {
  const query = db('products').where('seller_id', sellerId);
  if (scope && SELLER_SCOPES[scope]) {
    query.modify(SELLER_SCOPES[scope]);
  }
  return query.count('id as count').first();
}

function buildSellerProductQuery(sellerId) {
  return db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .where('seller_id', sellerId)
    .select('products.*', 'categories.name as category_name', BID_COUNT_SUBQUERY);
}

export function findAll() {
  return db('products')
    .leftJoin('users as bidder', 'products.highest_bidder_id', 'bidder.id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .select(
      'products.*', 'seller.fullname as seller_name', 'bidder.fullname as highest_bidder_name',
      BID_COUNT_SUBQUERY
    );
}

/**
 * Unified product finder by ID.
 * @param {number} productId - Product ID
 * @param {number|null} userId - Current user ID (for watchlist check), null if not logged in
 * @param {Object} [options] - Query options
 * @param {boolean} [options.maskBidderName=true] - Whether to mask bidder name for privacy
 * @param {boolean} [options.includeEmails=true] - Whether to include seller/bidder emails
 * @param {boolean} [options.includeSellerCreatedAt=true] - Whether to include seller join date
 */
export async function findByProductId(productId, userId, { maskBidderName = true, includeEmails = true, includeSellerCreatedAt = true } = {}) {
  const selectColumns = [
    'products.*',
    'product_images.img_link',
    'seller.fullname as seller_name',
    'categories.name as category_name',
    BID_COUNT_SUBQUERY,
    IS_FAVORITE_CHECK,
  ];

  // Bidder name: masked for public, raw for admin
  if (maskBidderName) {
    selectColumns.push(db.raw('mask_name_alternating(bidder.fullname) AS bidder_name'));
  }
  selectColumns.push('bidder.fullname as highest_bidder_name');

  // Optionally include emails (needed for notifications)
  if (includeEmails) {
    selectColumns.push('seller.email as seller_email');
    selectColumns.push('bidder.email as highest_bidder_email');
  }

  // Optionally include seller join date
  if (includeSellerCreatedAt) {
    selectColumns.push('seller.created_at as seller_created_at');
  }

  const rows = await db('products')
    .leftJoin('users as bidder', 'products.highest_bidder_id', 'bidder.id')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .leftJoin('product_images', 'products.id', 'product_images.product_id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .modify(scopeWatchlist, userId)
    .where('products.id', productId)
    .select(selectColumns);

  if (rows.length === 0) return null;

  const product = rows[0];
  product.sub_images = rows
    .map(row => row.img_link)
    .filter(link => link && link !== product.thumbnail);

  return product;
}

// Backward-compatible alias (admin pages: no masking, no emails)
export async function findByProductIdForAdmin(productId, userId) {
  return findByProductId(productId, userId, { maskBidderName: false, includeEmails: false, includeSellerCreatedAt: false });
}

export function findPage(limit, offset) {
  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .select(
      'products.*', 
    
      MASKED_BIDDER_NAME,
      BID_COUNT_SUBQUERY
    ).limit(limit).offset(offset);
}

// 1. Hàm tìm kiếm phân trang (Simplified FTS - Search in product name and category)

// --- Private: Áp dụng keyword filter (AND/OR) lên query builder ---
function applyKeywordFilter(builder, words, logic) {
  if (logic === 'and') {
    // AND logic: tất cả keywords đều phải match
    words.forEach(word => {
      builder.where(function() {
        this.whereRaw(`LOWER(remove_accents(products.name)) LIKE ?`, [`%${word}%`])
          .orWhereRaw(`LOWER(remove_accents(categories.name)) LIKE ?`, [`%${word}%`])
          .orWhereRaw(`LOWER(remove_accents(parent_category.name)) LIKE ?`, [`%${word}%`]);
      });
    });
  } else {
    // OR logic: bất kỳ keyword nào match đều được
    words.forEach(word => {
      builder.orWhere(function() {
        this.whereRaw(`LOWER(remove_accents(products.name)) LIKE ?`, [`%${word}%`])
          .orWhereRaw(`LOWER(remove_accents(categories.name)) LIKE ?`, [`%${word}%`])
          .orWhereRaw(`LOWER(remove_accents(parent_category.name)) LIKE ?`, [`%${word}%`]);
      });
    });
  }
}

// --- Private: Base query chung cho search + count ---
function buildSearchQuery(keywords, logic) {
  const searchQuery = normalizeSearchText(keywords);
  const words = searchQuery.split(/\s+/).filter(w => w.length > 0);

  return db('products')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('categories as parent_category', 'categories.parent_id', 'parent_category.id')
    .modify(scopeActive)
    .where((builder) => applyKeywordFilter(builder, words, logic));
}

export function searchPageByKeywords(keywords, limit, offset, userId, logic = 'or', sort = '') {
  return buildSearchQuery(keywords, logic)
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .modify(scopeWatchlist, userId)
    .select(
      'products.*',
      'categories.name as category_name',
      MASKED_BIDDER_NAME,
      BID_COUNT_SUBQUERY,
      IS_FAVORITE_CHECK
    )
    .modify((qb) => applySorting(qb, sort, 'products.end_at', 'asc'))
    .limit(limit)
    .offset(offset);
}

export function countByKeywords(keywords, logic = 'or') {
  return buildSearchQuery(keywords, logic)
    .count('products.id as count')
    .first();
}
export function countAll() {
  return db('products').count('id as count').first();
}

// DRY fix: Unified category filter (merges findByCategoryId + findByCategoryIds)
export function findByCategoryFilter(categoryIds, limit, offset, sort, currentUserId) {
  const filterFn = Array.isArray(categoryIds)
    ? (q) => q.whereIn('products.category_id', categoryIds)
    : (q) => q.where('products.category_id', categoryIds);

  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .modify(scopeWatchlist, currentUserId)
    .modify(filterFn)
    .modify(scopeActive)
    .select(
      'products.*',
      MASKED_BIDDER_NAME,
      BID_COUNT_SUBQUERY,
      IS_FAVORITE_CHECK
    )
    .modify((qb) => applySorting(qb, sort))
    .limit(limit)
    .offset(offset);
}

// Backward-compatible aliases
export function findByCategoryId(categoryId, limit, offset, sort, currentUserId) {
  return findByCategoryFilter(categoryId, limit, offset, sort, currentUserId);
}

export function findByCategoryIds(categoryIds, limit, offset, sort, currentUserId) {
  return findByCategoryFilter(categoryIds, limit, offset, sort, currentUserId);
}

export function countByCategoryId(categoryId) {
  return db('products')
    .where('category_id', categoryId)
    .count('id as count')
    .first();
}

export function countByCategoryIds(categoryIds) {
  return db('products')
    .whereIn('category_id', categoryIds)
    .modify(scopeActive)
    .count('id as count')
    .first();
}

// Helper chung để select cột và che tên bidder
const BASE_QUERY = db('products')
  .leftJoin('users', 'products.highest_bidder_id', 'users.id')
  .select(
    'products.*',
    MASKED_BIDDER_NAME,
    BID_COUNT_SUBQUERY
  )
  .where('end_at', '>', new Date()) // Chỉ lấy sản phẩm chưa hết hạn
  .limit(5); // Top 5

export function findTopEnding() {
  // Sắp hết hạn: Sắp xếp thời gian kết thúc TĂNG DẦN (gần nhất lên đầu)
  return BASE_QUERY.clone().modify(scopeActive).orderBy('end_at', 'asc');
}

export function findTopPrice() {
  // Giá cao nhất: Sắp xếp giá hiện tại GIẢM DẦN
  return BASE_QUERY.clone().modify(scopeActive).orderBy('current_price', 'desc');
}

export function findTopBids() {
  // Nhiều lượt ra giá nhất: Sắp xếp theo số lượt bid GIẢM DẦN
  return db('products')
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .select(
      'products.*',
      MASKED_BIDDER_NAME,
      BID_COUNT_SUBQUERY
    )
    .modify(scopeActive)
    .orderBy('bid_count', 'desc') // Order by cột alias bid_count
    .limit(5);
}

export function findRelatedProducts(productId) {
    return db('products')
      .leftJoin('products as p2', 'products.category_id', 'p2.category_id')
      .where('products.id', productId)
      .andWhere('p2.id', '!=', productId)
      .select('p2.*')
      .limit(5);
  } 

// Backward-compatible alias for existing callers
export async function findByProductId2(productId, userId) {
  return findByProductId(productId, userId);
}

export function addProduct(product) {
  return db('products').insert(product).returning('id');
}

export function addProductImages(images) {
  return db('product_images').insert(images);
}

export function updateProductThumbnail(productId, thumbnailPath) {
  return db('products')
    .where('id', productId)
    .update({ thumbnail: thumbnailPath });
}

export function updateProduct(productId, productData) {
  return db('products')
    .where('id', productId)
    .update(productData);
}

export function deleteProduct(productId) {
  return db('products')
    .where('id', productId)
    .del();
}

// DRY fix: Seller count functions use shared countBySellerScope
export function countProductsBySellerId(sellerId) {
  return countBySellerScope(sellerId, null);
}

export function countActiveProductsBySellerId(sellerId) {
  return countBySellerScope(sellerId, 'active');
}

export function countSoldProductsBySellerId(sellerId) {
  return countBySellerScope(sellerId, 'sold');
}

export function countPendingProductsBySellerId(sellerId) {
  return countBySellerScope(sellerId, 'pending');
}

export function countExpiredProductsBySellerId(sellerId) {
  return countBySellerScope(sellerId, 'expired');
}

export async function getSellerStats(sellerId) {
  // DEPRECATED: Business logic moved to product.service.js getSellerStats()
  // This function is kept for backward compatibility
  const { getSellerStats: getStats } = await import('../services/product.service.js');
  return getStats(sellerId);
}

/**
 * Sum pending revenue (sản phẩm hết hạn/closed, có người thắng nhưng chưa thanh toán)
 */
export function sumPendingRevenue(sellerId) {
  return db('products')
    .where('seller_id', sellerId)
    .modify(SELLER_SCOPES.pending)
    .sum('current_price as revenue')
    .first();
}

/**
 * Sum completed revenue (sản phẩm đã bán thành công)
 */
export function sumCompletedRevenue(sellerId) {
  return db('products')
    .where('seller_id', sellerId)
    .modify(SELLER_SCOPES.sold)
    .sum('current_price as revenue')
    .first();
}

// DRY fix: Seller product list queries use shared buildSellerProductQuery
export function findAllProductsBySellerId(sellerId) {
  return buildSellerProductQuery(sellerId)
    .select(PRODUCT_STATUS_CASE);
}

export function findActiveProductsBySellerId(sellerId) {
  return buildSellerProductQuery(sellerId)
    .modify(SELLER_SCOPES.active);
}

export function findPendingProductsBySellerId(sellerId) {
  return buildSellerProductQuery(sellerId)
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .modify(SELLER_SCOPES.pending)
    .select(
      'users.fullname as highest_bidder_name',
      'users.email as highest_bidder_email'
    );
}

export function findSoldProductsBySellerId(sellerId) {
  return buildSellerProductQuery(sellerId)
    .leftJoin('users', 'products.highest_bidder_id', 'users.id')
    .modify(SELLER_SCOPES.sold)
    .select(
      'users.fullname as highest_bidder_name',
      'users.email as highest_bidder_email'
    );
}

export function findExpiredProductsBySellerId(sellerId) {
  return buildSellerProductQuery(sellerId)
    .modify(SELLER_SCOPES.expired)
    .select(PRODUCT_STATUS_CASE);
}

// DRY fix: Unified stats function (merges getSoldProductsStats + getPendingProductsStats)
async function getProductsStatsByScope(sellerId, scopeFn, countAlias, revenueAlias) {
  const result = await db('products')
    .where('seller_id', sellerId)
    .modify(scopeFn)
    .select(
      db.raw(`COUNT(products.id) as ${countAlias}`),
      db.raw(`COALESCE(SUM(products.current_price), 0) as ${revenueAlias}`),
      BIDS_SUM_SUBQUERY
    )
    .first();

  return {
    [countAlias]: parseInt(result[countAlias]) || 0,
    [revenueAlias]: parseFloat(result[revenueAlias]) || 0,
    total_bids: parseInt(result.total_bids) || 0
  };
}

export async function getSoldProductsStats(sellerId) {
  return getProductsStatsByScope(sellerId, SELLER_SCOPES.sold, 'total_sold', 'total_revenue');
}

export async function getPendingProductsStats(sellerId) {
  return getProductsStatsByScope(sellerId, SELLER_SCOPES.pending, 'total_pending', 'pending_revenue');
}

export async function cancelProduct(productId, sellerId) {
  // DEPRECATED: Business logic moved to product.service.js cancelProduct()
  // This function is kept for backward compatibility
  const { cancelProduct: cancel } = await import('../services/product.service.js');
  return cancel(productId, sellerId);
}

/**
 * Lấy các auction vừa kết thúc mà chưa gửi thông báo
 * Điều kiện: end_at < now() AND end_notification_sent IS NULL
 * @returns {Promise<Array>} Danh sách các sản phẩm kết thúc cần gửi thông báo
 */
export async function getNewlyEndedAuctions() {
  return db('products')
    .leftJoin('users as seller', 'products.seller_id', 'seller.id')
    .leftJoin('users as winner', 'products.highest_bidder_id', 'winner.id')
    .where('products.end_at', '<', new Date())
    .whereNull('products.end_notification_sent')
    .select(
      'products.id',
      'products.name',
      'products.current_price',
      'products.highest_bidder_id',
      'products.seller_id',
      'products.end_at',
      'products.is_sold',
      'seller.fullname as seller_name',
      'seller.email as seller_email',
      'winner.fullname as winner_name',
      'winner.email as winner_email'
    );
}

/**
 * Đánh dấu auction đã gửi thông báo kết thúc
 * @param {number} productId - ID sản phẩm
 */
export async function markEndNotificationSent(productId) {
  return db('products')
    .where('id', productId)
    .update({
      end_notification_sent: new Date()
    });
}