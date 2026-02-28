import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as autoBiddingModel from '../models/autoBidding.model.js';
import * as reviewModel from '../models/review.model.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import db from '../utils/db.js';
import { sendBidNotificationEmails, sendRejectBidderEmail } from '../utils/bidNotification.js';

/**
 * ============================================
 * BIDDING SERVICE
 * ============================================
 * Business logic cho đấu giá:
 * - Đặt bid (auto-bidding, buy-now trigger, auto-extend)
 * - Reject/unreject bidder
 * - Buy Now
 * - Email notification cho seller/bidder
 */

export async function getBiddingHistory(productId) {
  return biddingHistoryModel.getBiddingHistory(productId);
}

// simple passthroughs to autoBidding model
export function getBiddingProductsByBidderId(bidderId) {
  return autoBiddingModel.getBiddingProductsByBidderId(bidderId);
}

export function getWonAuctionsByBidderId(bidderId) {
  return autoBiddingModel.getWonAuctionsByBidderId(bidderId);
}

// ============ VALIDATION HELPERS ============

/**
 * Kiểm tra product tồn tại
 */
async function validateProductExists(trx, productId) {
  const product = await trx('products').where('id', productId).first();
  if (!product) throw new Error('Product not found');
  return product;
}

/**
 * Kiểm tra product chưa bán
 */
function validateProductNotSold(product) {
  if (product.is_sold === true) {
    throw new Error('This product has already been sold');
  }
}

/**
 * Kiểm tra user không phải seller
 */
function validateBidderNotSeller(product, userId) {
  if (product.seller_id === userId) {
    throw new Error('You cannot bid on your own product');
  }
}

/**
 * Kiểm tra user không bị reject
 */
async function validateBidderNotRejected(trx, productId, userId) {
  const isRejected = await trx('rejected_bidders')
    .where('product_id', productId)
    .where('bidder_id', userId)
    .first();

  if (isRejected) {
    throw new Error('You have been rejected from bidding on this product by the seller');
  }
}

/**
 * Kiểm tra rating của bidder
 */
async function validateBidderRating(product, userId) {
  const ratingPoint = await reviewModel.calculateRatingPoint(userId);
  const userReviews = await reviewModel.getReviewsByUserId(userId);
  const hasReviews = userReviews.length > 0;

  if (!hasReviews) {
    if (!product.allow_unrated_bidder) {
      throw new Error('This seller does not allow unrated bidders to bid on this product.');
    }
  } else if (ratingPoint.rating_point <= 0) {
    throw new Error('You are not eligible to place bids due to your rating.');
  } else if (ratingPoint.rating_point <= 0.8) {
    throw new Error('Your rating point is not greater than 80%. You cannot place bids.');
  }
}

/**
 * Kiểm tra auction chưa kết thúc
 */
function validateAuctionActive(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);
  if (now > endDate) throw new Error('Auction has ended');
}

/**
 * Kiểm tra bid amount (giá phải cao hơn current price + step price)
 */
function validateBidAmount(product, bidAmount) {
  const currentPrice = parseFloat(product.current_price || product.starting_price);
  const minIncrement = parseFloat(product.step_price);

  if (bidAmount <= currentPrice) {
    throw new Error(`Bid must be higher than current price (${currentPrice.toLocaleString()} VND)`);
  }

  if (bidAmount < currentPrice + minIncrement) {
    throw new Error(
      `Bid must be at least ${minIncrement.toLocaleString()} VND higher than current price`
    );
  }
}

/**
 * Nhóm tất cả validations
 */
async function validateBidRequest(trx, productId, userId, bidAmount, product) {
  validateProductNotSold(product);
  validateBidderNotSeller(product, userId);
  await validateBidderNotRejected(trx, productId, userId);
  await validateBidderRating(product, userId);
  validateAuctionActive(product);
  validateBidAmount(product, bidAmount);
}

// ============ DATA PREPARATION HELPERS ============

/**
 * Kiểm tra auto-extend và tính thời gian mới nếu cần
 */
async function checkAutoExtend(product) {
  if (!product.auto_extend) return null;

  const settings = await systemSettingModel.getSettings();
  const triggerMinutes = settings?.auto_extend_trigger_minutes;
  const extendMinutes = settings?.auto_extend_duration_minutes;

  const now = new Date();
  const endTime = new Date(product.end_at);
  const minutesRemaining = (endTime - now) / (1000 * 60);

  if (minutesRemaining <= triggerMinutes) {
    return new Date(endTime.getTime() + extendMinutes * 60 * 1000);
  }

  return null;
}

/**
 * Tính giá mới sau khi bid (auto-bidding logic)
 */
function calculateNewPrice(product, bidAmount, userId) {
  const buyNowPrice = product.buy_now_price ? parseFloat(product.buy_now_price) : null;
  const minIncrement = parseFloat(product.step_price);
  let buyNowTriggered = false;
  let newCurrentPrice, newHighestBidderId, newHighestMaxPrice;
  let shouldCreateHistory = true;

  // Check nếu current highest bidder đã có max_price >= buy_now_price
  if (buyNowPrice && product.highest_bidder_id && product.highest_max_price && product.highest_bidder_id !== userId) {
    const currentHighestMaxPrice = parseFloat(product.highest_max_price);
    if (currentHighestMaxPrice >= buyNowPrice) {
      return {
        newCurrentPrice: buyNowPrice,
        newHighestBidderId: product.highest_bidder_id,
        newHighestMaxPrice: currentHighestMaxPrice,
        buyNowTriggered: true,
        shouldCreateHistory: true,
      };
    }
  }

  if (product.highest_bidder_id === userId) {
    // Cùng người bid → chỉ update max price
    newCurrentPrice = parseFloat(product.current_price || product.starting_price);
    newHighestBidderId = userId;
    newHighestMaxPrice = bidAmount;
    shouldCreateHistory = false;
  } else if (!product.highest_bidder_id || !product.highest_max_price) {
    // Chưa có ai bid
    newCurrentPrice = product.starting_price;
    newHighestBidderId = userId;
    newHighestMaxPrice = bidAmount;
  } else {
    // So sánh auto-bidding
    const currentHighestMaxPrice = parseFloat(product.highest_max_price);
    const currentHighestBidderId = product.highest_bidder_id;

    if (bidAmount <= currentHighestMaxPrice) {
      newCurrentPrice = bidAmount;
      newHighestBidderId = currentHighestBidderId;
      newHighestMaxPrice = currentHighestMaxPrice;
    } else {
      newCurrentPrice = currentHighestMaxPrice + minIncrement;
      newHighestBidderId = userId;
      newHighestMaxPrice = bidAmount;
    }
  }

  // Check buy-now trigger
  if (buyNowPrice && newCurrentPrice >= buyNowPrice) {
    newCurrentPrice = buyNowPrice;
    buyNowTriggered = true;
  }

  return { newCurrentPrice, newHighestBidderId, newHighestMaxPrice, buyNowTriggered, shouldCreateHistory };
}

/**
 * Chuẩn bị bid context (gather all data needed)
 */
async function prepareBidContext(trx, productId, product, userId, bidAmount) {
  const previousHighestBidderId = product.highest_bidder_id;
  const previousPrice = parseFloat(product.current_price || product.starting_price);

  const extendedEndTime = await checkAutoExtend(product);
  if (extendedEndTime) product.end_at = extendedEndTime;

  const priceResult = calculateNewPrice(product, bidAmount, userId);

  return {
    product,
    productId,
    userId,
    bidAmount,
    previousHighestBidderId,
    previousPrice,
    extendedEndTime,
    priceResult,
  };
}

// ============ DATABASE UPDATE HELPERS ============

/**
 * Cập nhật giá sản phẩm
 */
async function updateProductPrice(trx, context) {
  const updateData = {
    current_price: context.priceResult.newCurrentPrice,
    highest_bidder_id: context.priceResult.newHighestBidderId,
    highest_max_price: context.priceResult.newHighestMaxPrice,
  };

  if (context.priceResult.buyNowTriggered) {
    updateData.end_at = new Date();
    updateData.closed_at = new Date();
  } else if (context.extendedEndTime) {
    updateData.end_at = context.extendedEndTime;
  }

  await trx('products').where('id', context.productId).update(updateData);
}

/**
 * Tạo bidding history nếu cần
 */
async function createBiddingHistory(trx, context) {
  if (context.priceResult.shouldCreateHistory) {
    await trx('bidding_history').insert({
      product_id: context.productId,
      bidder_id: context.priceResult.newHighestBidderId,
      current_price: context.priceResult.newCurrentPrice,
    });
  }
}

/**
 * Upsert auto bidding
 */
async function upsertAutoBidding(trx, context) {
  await trx.raw(
    `INSERT INTO auto_bidding (product_id, bidder_id, max_price)
     VALUES (?, ?, ?)
     ON CONFLICT (product_id, bidder_id)
     DO UPDATE SET max_price = EXCLUDED.max_price, created_at = NOW()`,
    [context.productId, context.userId, context.bidAmount]
  );
}

/**
 * Thực hiện tất cả database updates
 */
async function executeBid(trx, context) {
  await updateProductPrice(trx, context);
  await createBiddingHistory(trx, context);
  await upsertAutoBidding(trx, context);
}

// ============ MAIN FUNCTIONS ============

/**
 * Đặt bid (core business logic - orchestrator)
 * @returns {object} Kết quả bid bao gồm giá mới, winner, trạng thái sold, etc.
 */
export async function placeBid(productId, userId, bidAmount, productUrl) {
  const result = await db.transaction(async (trx) => {
    // 1. Kiểm tra product tồn tại
    const product = await validateProductExists(trx, productId);
    
    // 2. Validate tất cả điều kiện
    await validateBidRequest(trx, productId, userId, bidAmount, product);

    // 3. Chuẩn bị dữ liệu cần thiết
    const context = await prepareBidContext(trx, productId, product, userId, bidAmount);

    // 4. Thực hiện cập nhật database
    await executeBid(trx, context);

    // 5. Trả kết quả
    return buildBidResult(context);
  });

  // Fire-and-forget: trigger bid notification emails after transaction commits
  try {
    if (productUrl) sendBidNotificationEmails(result, productUrl);
  } catch (notifErr) {
    console.error('Failed to trigger bid notifications:', notifErr);
  }

  return result;
}

/**
 * Dựng result object từ bid context
 */
function buildBidResult(context) {
  return {
    productId: context.productId,
    newCurrentPrice: context.priceResult.newCurrentPrice,
    newHighestBidderId: context.priceResult.newHighestBidderId,
    userId: context.userId,
    bidAmount: context.bidAmount,
    productSold: context.priceResult.buyNowTriggered,
    autoExtended: !!context.extendedEndTime,
    newEndTime: context.extendedEndTime,
    productName: context.product.name,
    sellerId: context.product.seller_id,
    previousHighestBidderId: context.previousHighestBidderId,
    previousPrice: context.previousPrice,
    priceChanged: context.previousPrice !== context.priceResult.newCurrentPrice,
  };
}

/**
 * Build message kết quả bid để hiển thị cho user
 */
export function buildBidResultMessage(result) {
  let baseMessage = '';
  if (result.productSold) {
    if (result.newHighestBidderId === result.userId) {
      baseMessage = `Congratulations! You won the product with Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Please proceed to payment.`;
    } else {
      baseMessage = `Product has been sold to another bidder at Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Your bid helped reach the Buy Now threshold.`;
    }
  } else if (result.newHighestBidderId === result.userId) {
    baseMessage = `Bid placed successfully! Current price: ${result.newCurrentPrice.toLocaleString()} VND (Your max: ${result.bidAmount.toLocaleString()} VND)`;
  } else {
    baseMessage = `Bid placed! Another bidder is currently winning at ${result.newCurrentPrice.toLocaleString()} VND`;
  }

  if (result.autoExtended) {
    const extendedTimeStr = new Date(result.newEndTime).toLocaleString('vi-VN');
    baseMessage += ` | Auction extended to ${extendedTimeStr}`;
  }

  return baseMessage;
}

/**
 * Reject bidder khỏi auction (seller action)
 * @returns {{ rejectedUser, product, seller }} Thông tin để gửi email
 */

// helper functions extracted to keep business logic small and readable
async function lockProductForSeller(trx, productId, sellerId) {
  const product = await trx('products')
    .where('id', productId)
    .forUpdate()
    .first();
  if (!product) throw new Error('Product not found');
  if (product.seller_id !== sellerId) throw new Error('Only the seller can reject bidders');
  const now = new Date();
  const endDate = new Date(product.end_at);
  if (product.is_sold !== null || endDate <= now || product.closed_at) {
    throw new Error('Can only reject bidders for active auctions');
  }
  return product;
}

async function ensureBidderHasAutoBid(trx, productId, bidderId) {
  const autoBid = await trx('auto_bidding')
    .where('product_id', productId)
    .where('bidder_id', bidderId)
    .first();
  if (!autoBid) throw new Error('This bidder has not placed a bid on this product');
}

async function gatherRejectData(trx, productId, bidderId, sellerId, product) {
  const rejectedBidderInfo = await trx('users').where('id', bidderId).first();
  const sellerInfo = await trx('users').where('id', sellerId).first();
  return { rejectedBidderInfo, sellerInfo, productInfo: product };
}

async function insertRejectedBidder(trx, productId, bidderId, sellerId) {
  await trx('rejected_bidders')
    .insert({ product_id: productId, bidder_id: bidderId, seller_id: sellerId })
    .onConflict(['product_id', 'bidder_id'])
    .ignore();
}

async function clearBidderRecords(trx, productId, bidderId) {
  await trx('bidding_history').where('product_id', productId).where('bidder_id', bidderId).del();
  await trx('auto_bidding').where('product_id', productId).where('bidder_id', bidderId).del();
}

async function recalcPricesAfterRejection(trx, product, productId, bidderId) {
  const allAutoBids = await trx('auto_bidding')
    .where('product_id', productId)
    .orderBy('max_price', 'desc');

  const bidderIdNum = parseInt(bidderId);
  const highestBidderIdNum = parseInt(product.highest_bidder_id);
  const wasHighestBidder = highestBidderIdNum === bidderIdNum;

  if (allAutoBids.length === 0) {
    await trx('products').where('id', productId).update({
      highest_bidder_id: null,
      current_price: product.starting_price,
      highest_max_price: null,
    });
  } else if (allAutoBids.length === 1) {
    const winner = allAutoBids[0];
    await trx('products').where('id', productId).update({
      highest_bidder_id: winner.bidder_id,
      current_price: product.starting_price,
      highest_max_price: winner.max_price,
    });
    if (wasHighestBidder || product.current_price !== product.starting_price) {
      await trx('bidding_history').insert({
        product_id: productId,
        bidder_id: winner.bidder_id,
        current_price: product.starting_price,
      });
    }
  } else if (wasHighestBidder) {
    const firstBidder = allAutoBids[0];
    const secondBidder = allAutoBids[1];
    let newPrice = secondBidder.max_price + product.step_price;
    if (newPrice > firstBidder.max_price) newPrice = firstBidder.max_price;

    await trx('products').where('id', productId).update({
      highest_bidder_id: firstBidder.bidder_id,
      current_price: newPrice,
      highest_max_price: firstBidder.max_price,
    });

    const lastHistory = await trx('bidding_history')
      .where('product_id', productId)
      .orderBy('created_at', 'desc')
      .first();

    if (!lastHistory || lastHistory.current_price !== newPrice) {
      await trx('bidding_history').insert({
        product_id: productId,
        bidder_id: firstBidder.bidder_id,
        current_price: newPrice,
      });
    }
  }
}

export async function rejectBidder(productId, bidderId, sellerId) {
  let rejectedBidderInfo = null;
  let productInfo = null;
  let sellerInfo = null;

  const result = await db.transaction(async (trx) => {
    const product = await lockProductForSeller(trx, productId, sellerId);
    await ensureBidderHasAutoBid(trx, productId, bidderId);

    const gathered = await gatherRejectData(trx, productId, bidderId, sellerId, product);
    rejectedBidderInfo = gathered.rejectedBidderInfo;
    productInfo = gathered.productInfo;
    sellerInfo = gathered.sellerInfo;

    await insertRejectedBidder(trx, productId, bidderId, sellerId);
    await clearBidderRecords(trx, productId, bidderId);
    await recalcPricesAfterRejection(trx, product, productId, bidderId);

    return { rejectedBidderInfo, product, sellerInfo };
  });

  // after successful transaction send notification email
  try {
    const homeUrl = `${process.env.APP_BASE_URL || ''}/`;
    sendRejectBidderEmail(rejectedBidderInfo, productInfo, sellerInfo?.fullname || 'N/A', homeUrl);
  } catch (err) {
    console.error('Failed to send reject bidder email:', err);
  }

  return { rejectedUser: rejectedBidderInfo, product: productInfo, seller: sellerInfo };
}

/**
 * Unreject bidder (seller action) - remove from rejected list
 */
export async function unrejectBidder(productId, bidderId, sellerId) {
  await db.transaction(async (trx) => {
    const product = await lockProductForSeller(trx, productId, sellerId);
    await trx('rejected_bidders')
      .where({ product_id: productId, bidder_id: bidderId })
      .del();
  });

  return { success: true };
}

export async function buyNow(productId, userId) {
  await db.transaction(async (trx) => {
    const product = await validateProductExists(trx, productId);
    validateProductNotSold(product);
    validateBidderNotSeller(product, userId);
    validateAuctionActive(product);
    await validateBidderNotRejected(trx, productId, userId);
    await validateBidderRating(product, userId);

    if (!product.buy_now_price) throw new Error('Buy Now option is not available for this product');

    const now = new Date();
    const buyNowPrice = parseFloat(product.buy_now_price);

    await trx('products').where('id', productId).update({
      current_price: buyNowPrice,
      highest_bidder_id: userId,
      highest_max_price: buyNowPrice,
      end_at: now,
      closed_at: now,
      is_buy_now_purchase: true,
    });

    await trx('bidding_history').insert({
      product_id: productId,
      bidder_id: userId,
      current_price: buyNowPrice,
      is_buy_now: true,
    });
  });
}