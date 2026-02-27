import * as productModel from '../models/product.model.js';
import { getPagination, buildPaginationInfo } from '../utils/pagination.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import * as descriptionService from './productDescription.service.js';
import * as biddingService from './bidding.service.js';
import * as commentService from './comment.service.js';
import * as ratingService from './rating.service.js';
import * as rejectedBidderService from './rejectedBidder.service.js';
import db from '../utils/db.js';
import path from 'path';
import fs from 'fs';

/**
 * Build a standardized product data object from the raw form body.
 * @param {object} body - req.body from the product add form
 * @param {number|string} sellerId - the seller's user ID
 * @returns {object} productData ready for insertion
 */
export function buildProductData(body, sellerId) {
    return {
        seller_id: sellerId,
        category_id: body.category_id,
        name: body.name,
        starting_price: body.start_price.replace(/,/g, ''),
        step_price: body.step_price.replace(/,/g, ''),
        buy_now_price: body.buy_now_price !== '' ? body.buy_now_price.replace(/,/g, '') : null,
        created_at: new Date(body.created_at),
        end_at: new Date(body.end_date),
        auto_extend: body.auto_extend === '1',
        thumbnail: null,
        description: body.description,
        highest_bidder_id: null,
        current_price: body.start_price.replace(/,/g, ''),
        is_sold: null,
        closed_at: null,
        allow_unrated_bidder: body.allow_new_bidders === '1',
    };
}

/**
 * Move the uploaded thumbnail to the permanent product images directory
 * and update the product record with the saved path.
 * @param {number} productId
 * @param {string} thumbnailUploadPath - temporary upload filename / path
 */
async function moveAndSaveThumbnail(productId, thumbnailUploadPath) {
    const dirPath = path.join('public', 'images', 'products').replace(/\\/g, '/');
    const destPath = path.join(dirPath, `p${productId}_thumb.jpg`).replace(/\\/g, '/');
    const srcPath = path.join('public', 'uploads', path.basename(thumbnailUploadPath)).replace(/\\/g, '/');
    const savedDbPath = '/' + path.join('images', 'products', `p${productId}_thumb.jpg`).replace(/\\/g, '/');

    fs.renameSync(srcPath, destPath);
    await productModel.updateProductThumbnail(productId, savedDbPath);
}

/**
 * Move uploaded sub-images to the permanent product images directory
 * and insert the image records into the database.
 * @param {number} productId
 * @param {string[]} imgsList - array of temporary upload paths
 */
async function moveAndSaveSubimages(productId, imgsList) {
    const dirPath = path.join('public', 'images', 'products').replace(/\\/g, '/');
    const newImgPaths = [];

    let i = 1;
    for (const imgPath of imgsList) {
        const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, '/');
        const newPath = path.join(dirPath, `p${productId}_${i}.jpg`).replace(/\\/g, '/');
        const savedPath = '/' + path.join('images', 'products', `p${productId}_${i}.jpg`).replace(/\\/g, '/');

        fs.renameSync(oldPath, newPath);
        newImgPaths.push({
            product_id: productId,
            img_link: savedPath,
        });
        i++;
    }

    await productModel.addProductImages(newImgPaths);
}

/**
 * Create a product with its thumbnail and sub-images.
 * Shared between admin and seller product-add flows.
 *
 * @param {object} productData - data object built by buildProductData()
 * @param {string} thumbnailPath - temporary upload path of the thumbnail
 * @param {string[]} imgsList - array of temporary sub-image upload paths
 * @returns {number} the newly created product's ID
 */
export async function createProductWithImages(productData, thumbnailPath, imgsList) {
    const returnedID = await productModel.addProduct(productData);
    const productId = returnedID[0].id;

    await moveAndSaveThumbnail(productId, thumbnailPath);
    await moveAndSaveSubimages(productId, imgsList);

    return productId;
}


export async function prepareProductList(products) {
  const now = new Date();
  if (!products) return [];
  
  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;
  
  return products.map(product => {
    const created = new Date(product.created_at);
    const isNew = (now - created) < (N_MINUTES * 60 * 1000);

    return {
      ...product,
      is_new: isNew
    };
  });
};



export async function getProductByCategory({categoryIds, category, currentPage, sort, userId}) 
{
  const { page, limit, offset } = getPagination(currentPage, 3);
  

  const list = await productModel.findByCategoryIds(
    categoryIds,
    limit,
    offset,
    sort,
    userId
  );

  const products = await prepareProductList(list);

  const total = await productModel.countByCategoryIds(categoryIds);
  const totalCount = parseInt(total.count) || 0;

  const { totalPages, from, to } = buildPaginationInfo(page, limit, totalCount);

  return {
    products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages,
    categoryId: category.id,
    categoryName: category.name,
    sort
  };
}


export async function getSearchProducts({
  q,
  currentPage,
  userId,
  logic = 'and',
  sort = ''
}) {

  if (!q || q.trim().length === 0) {
    return {
      products: [],
      totalCount: 0,
      from: 0,
      to: 0,
      currentPage: 1,
      totalPages: 0,
    };
  }

  
  const { page, limit, offset } = getPagination(currentPage, 3);

  const keywords = q.trim();

  
  const list = await productModel.searchPageByKeywords(
    keywords,
    limit,
    offset,
    userId,
    logic,
    sort
  );

  const products = await prepareProductList(list);


  const total = await productModel.countByKeywords(keywords, logic);
  const totalCount = parseInt(total.count) || 0;

  const { totalPages, from, to } = buildPaginationInfo(page, limit, totalCount);

  return {
    products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages
  };
}
const rules = [
  {
    match: (p) => p.is_sold === true,
    status: 'SOLD'
  },
  {
    match: (p) => p.is_sold === false,
    status: 'CANCELLED'
  },
  {
    match: (p) => {
      const now = new Date();
      const endDate = new Date(p.end_at);
      return (endDate <= now || p.closed_at) && p.highest_bidder_id;
    },
    status: 'PENDING'
  },
    {
    match: (p) => {      const now = new Date();
      const endDate = new Date(p.end_at);
      return endDate <= now && !p.highest_bidder_id;
    },
    status: 'EXPIRED'
  },
  {
    match: (p) => {
      const now = new Date();
      const endDate = new Date(p.end_at);
      return endDate > now && !p.closed_at;
    },
    status: 'ACTIVE'
  }
];

export function determineProductStatus(product) {
  const rule = rules.find(r => r.match(product));
  return rule ? rule.status : 'ACTIVE';
}

function canViewProduct(productStatus, product, userId) {
  if (productStatus === 'ACTIVE') return true;
  if (!userId) return false;

  return (
    product.seller_id === userId ||
    product.highest_bidder_id === userId
  );
}

async function autoCloseIfExpired(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    await productModel.updateProduct(product.id, { closed_at: endDate });
    product.closed_at = endDate;
  }
}


export async function getProduct(productId, userId) {
  return productModel.findByProductId2(productId, userId);
}

export async function getRelatedProducts(productId) {
  return productModel.findRelatedProducts(productId);
}

export async function getProductDetail(productId, userId, commentPage = 1) {

  const product = await getProduct(productId, userId);
  if (!product) return null;

  
  await autoCloseIfExpired(product);

  const productStatus = determineProductStatus(product);


  if (!canViewProduct(productStatus, product, userId)) {
    throw new Error('FORBIDDEN');
  }

  const commentsPerPage = 2;

  const [
    related_products,
    descriptionUpdates,
    biddingHistory,
    commentData,
    sellerRating
  ] = await Promise.all([
    getRelatedProducts(productId),
    descriptionService.getDescriptionUpdates(productId),
    biddingService.getBiddingHistory(productId),
    commentService.getCommentsWithReplies(productId, commentPage, commentsPerPage),
    ratingService.getUserRating(product.seller_id),
  ]);

  let bidderRating = { rating_point: null, has_reviews: false };
  if (product.highest_bidder_id) {
    bidderRating = await ratingService.getUserRating(product.highest_bidder_id);
  }

  let rejectedBidders = [];
  if (userId && product.seller_id === userId) {
    rejectedBidders =
      await rejectedBidderService.getRejectedBidders(productId);
  }


  const showPaymentButton =
    userId &&
    productStatus === 'PENDING' &&
    (
      product.seller_id === userId ||
      product.highest_bidder_id === userId
    );

  return {
    product,
    productStatus,

    related_products,
    descriptionUpdates,
    biddingHistory,
    rejectedBidders,

    comments: commentData.comments,
    totalComments: commentData.totalComments,
    totalPages: Math.ceil(commentData.totalComments / commentsPerPage),
    commentPage,

    seller_rating_point: sellerRating.rating_point,
    seller_has_reviews: sellerRating.has_reviews,

    bidder_rating_point: bidderRating.rating_point,
    bidder_has_reviews: bidderRating.has_reviews,

    showPaymentButton
  };
}


// ============================================================
// SELLER STATS (extracted from product.model.js)
// ============================================================

/**
 * Aggregation logic cho dashboard seller: tổng hợp 7 query song song
 * và tính toán revenue.
 */
export async function getSellerStats(sellerId) {
  const [total, active, sold, pending, expired, pendingRevenue, completedRevenue] = await Promise.all([
    productModel.countProductsBySellerId(sellerId),
    productModel.countActiveProductsBySellerId(sellerId),
    productModel.countSoldProductsBySellerId(sellerId),
    productModel.countPendingProductsBySellerId(sellerId),
    productModel.countExpiredProductsBySellerId(sellerId),
    productModel.sumPendingRevenue(sellerId),
    productModel.sumCompletedRevenue(sellerId),
  ]);

  const pendingRev = parseFloat(pendingRevenue.revenue) || 0;
  const completedRev = parseFloat(completedRevenue.revenue) || 0;

  return {
    total_products: parseInt(total.count) || 0,
    active_products: parseInt(active.count) || 0,
    sold_products: parseInt(sold.count) || 0,
    pending_products: parseInt(pending.count) || 0,
    expired_products: parseInt(expired.count) || 0,
    pending_revenue: pendingRev,
    completed_revenue: completedRev,
    total_revenue: pendingRev + completedRev,
  };
}


// ============================================================
// CANCEL PRODUCT (extracted from product.model.js)
// ============================================================

/**
 * Multi-step: verify seller → cancel active orders → update product state.
 */
export async function cancelProduct(productId, sellerId) {
  // Get product to verify seller
  const product = await db('products')
    .where('id', productId)
    .first();

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.seller_id !== sellerId) {
    throw new Error('Unauthorized');
  }

  // Cancel any active orders for this product
  const activeOrders = await db('orders')
    .where('product_id', productId)
    .whereNotIn('status', ['completed', 'cancelled']);

  for (let order of activeOrders) {
    await db('orders')
      .where('id', order.id)
      .update({
        status: 'cancelled',
        cancelled_by: sellerId,
        cancellation_reason: 'Seller cancelled the product',
        cancelled_at: new Date(),
      });
  }

  // Update product - mark as cancelled
  await productModel.updateProduct(productId, {
    is_sold: false,
    closed_at: new Date(),
  });

  return product;
}

// ------------------------------------------------------------------
// Convenience wrappers around product.model for controllers
// ------------------------------------------------------------------

export function getTopEnding() {
  return productModel.findTopEnding();
}

export function getTopBids() {
  return productModel.findTopBids();
}

export function getTopPrice() {
  return productModel.findTopPrice();
}

export function findAll() {
  return productModel.findAll();
}

export function findByProductIdForAdmin(id) {
  return productModel.findByProductIdForAdmin(id);
}

export function getAllProductsBySellerId(sellerId) {
  return productModel.findAllProductsBySellerId(sellerId);
}

export function getActiveProductsBySellerId(sellerId) {
  return productModel.findActiveProductsBySellerId(sellerId);
}

export function getPendingProductsBySellerId(sellerId) {
  return productModel.findPendingProductsBySellerId(sellerId);
}

export function getPendingProductsStats(sellerId) {
  return productModel.getPendingProductsStats(sellerId);
}

export function getSoldProductsBySellerId(sellerId) {
  return productModel.findSoldProductsBySellerId(sellerId);
}

export function getSoldProductsStats(sellerId) {
  return productModel.getSoldProductsStats(sellerId);
}

export function getExpiredProductsBySellerId(sellerId) {
  return productModel.findExpiredProductsBySellerId(sellerId);
}

export function updateProduct(id, data) {
  return productModel.updateProduct(id, data);
}

export function deleteProduct(id) {
  return productModel.deleteProduct(id);
}

// ============================================================
// TEXT NORMALIZE HELPER (extracted from duplicate in product.model.js)
// ============================================================

// Re-export normalizeSearchText from shared utility (DRY Fix — Vi phạm 16)
export { normalizeSearchText } from '../utils/text.js';