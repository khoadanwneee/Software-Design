import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as reviewModel from '../models/review.model.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import * as userModel from '../models/user.model.js';
import { sendMail } from '../utils/mailer.js';
import db from '../utils/db.js';

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

// ============ HELPERS ============

/**
 * Kiểm tra user có đủ điều kiện bid không (rating, rejected, etc.)
 */
async function validateBidderEligibility(trx, productId, userId, product) {
  if (product.seller_id === userId) {
    throw new Error('You cannot bid on your own product');
  }

  const isRejected = await trx('rejected_bidders')
    .where('product_id', productId)
    .where('bidder_id', userId)
    .first();

  if (isRejected) {
    throw new Error('You have been rejected from bidding on this product by the seller');
  }

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
 * Gửi email thông báo bid cho seller, bidder hiện tại, và bidder cũ
 */
function sendBidNotificationEmails(result, productUrl) {
  (async () => {
    try {
      const [seller, currentBidder, previousBidder] = await Promise.all([
        userModel.findById(result.sellerId),
        userModel.findById(result.userId),
        result.previousHighestBidderId && result.previousHighestBidderId !== result.userId
          ? userModel.findById(result.previousHighestBidderId)
          : null,
      ]);

      const emailPromises = [];

      if (seller?.email) {
        emailPromises.push(
          sendMail({
            to: seller.email,
            subject: `💰 New bid on your product: ${result.productName}`,
            html: buildSellerBidEmailHtml(seller, result, productUrl),
          })
        );
      }

      if (currentBidder?.email) {
        const isWinning = result.newHighestBidderId === result.userId;
        emailPromises.push(
          sendMail({
            to: currentBidder.email,
            subject: isWinning
              ? `✅ You're winning: ${result.productName}`
              : `📊 Bid placed: ${result.productName}`,
            html: buildBidderBidEmailHtml(currentBidder, result, productUrl, isWinning),
          })
        );
      }

      if (previousBidder?.email && result.priceChanged) {
        const wasOutbid = result.newHighestBidderId !== result.previousHighestBidderId;
        emailPromises.push(
          sendMail({
            to: previousBidder.email,
            subject: wasOutbid
              ? `⚠️ You've been outbid: ${result.productName}`
              : `📊 Price updated: ${result.productName}`,
            html: buildPreviousBidderEmailHtml(previousBidder, result, productUrl, wasOutbid),
          })
        );
      }

      if (emailPromises.length > 0) {
        await Promise.all(emailPromises);
        console.log(`${emailPromises.length} bid notification email(s) sent for product #${result.productId}`);
      }
    } catch (emailError) {
      console.error('Failed to send bid notification emails:', emailError);
    }
  })();
}

// ============ EMAIL TEMPLATES ============

function formatVND(amount) {
  return new Intl.NumberFormat('en-US').format(amount);
}

function buildSellerBidEmailHtml(seller, result, productUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">New Bid Received!</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>Dear <strong>${seller.fullname}</strong>,</p>
        <p>Great news! Your product has received a new bid:</p>
        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #72AEC8;">
          <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
          <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
          <p style="font-size: 28px; color: #72AEC8; margin: 5px 0; font-weight: bold;">${formatVND(result.newCurrentPrice)} VND</p>
          ${result.previousPrice !== result.newCurrentPrice ? `<p style="margin: 5px 0; color: #666; font-size: 14px;"><i>Previous: ${formatVND(result.previousPrice)} VND</i></p>` : ''}
        </div>
        ${result.productSold ? `<div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;"><p style="margin: 0; color: #155724;"><strong>🎉 Buy Now price reached!</strong> Auction has ended.</p></div>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Product</a>
        </div>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Online Auction.</p>
    </div>`;
}

function buildBidderBidEmailHtml(bidder, result, productUrl, isWinning) {
  const color = isWinning ? '#28a745' : '#ffc107';
  const colorDark = isWinning ? '#218838' : '#e0a800';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, ${color} 0%, ${colorDark} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${isWinning ? "You're Winning!" : 'Bid Placed'}</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>Dear <strong>${bidder.fullname}</strong>,</p>
        <p>${isWinning ? 'Congratulations! Your bid has been placed and you are currently the highest bidder!' : 'Your bid has been placed. However, another bidder has a higher maximum bid.'}</p>
        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${color};">
          <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
          <p style="margin: 5px 0;"><strong>Your Max Bid:</strong> ${formatVND(result.bidAmount)} VND</p>
          <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
          <p style="font-size: 28px; color: ${color}; margin: 5px 0; font-weight: bold;">${formatVND(result.newCurrentPrice)} VND</p>
        </div>
        ${result.productSold && isWinning ? `<div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;"><p style="margin: 0; color: #155724;"><strong>🎉 Congratulations! You won this product!</strong></p><p style="margin: 10px 0 0 0; color: #155724;">Please proceed to complete your payment.</p></div>` : ''}
        ${!isWinning ? `<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;"><p style="margin: 0; color: #856404;"><strong>💡 Tip:</strong> Consider increasing your maximum bid to improve your chances of winning.</p></div>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">${result.productSold && isWinning ? 'Complete Payment' : 'View Auction'}</a>
        </div>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Online Auction.</p>
    </div>`;
}

function buildPreviousBidderEmailHtml(prevBidder, result, productUrl, wasOutbid) {
  const color = wasOutbid ? '#dc3545' : '#ffc107';
  const colorDark = wasOutbid ? '#c82333' : '#e0a800';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, ${color} 0%, ${colorDark} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${wasOutbid ? "You've Been Outbid!" : 'Price Updated'}</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>Dear <strong>${prevBidder.fullname}</strong>,</p>
        ${wasOutbid ? `<p>Unfortunately, another bidder has placed a higher bid on the product you were winning:</p>` : `<p>Good news! You're still the highest bidder, but the current price has been updated due to a new bid:</p>`}
        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${color};">
          <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
          ${!wasOutbid ? `<p style="margin: 5px 0; color: #28a745;"><strong>✓ You're still winning!</strong></p>` : ''}
          <p style="margin: 5px 0;"><strong>New Current Price:</strong></p>
          <p style="font-size: 28px; color: ${color}; margin: 5px 0; font-weight: bold;">${formatVND(result.newCurrentPrice)} VND</p>
          <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;"><i>Previous price: ${formatVND(result.previousPrice)} VND</i></p>
        </div>
        ${wasOutbid ? `<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;"><p style="margin: 0; color: #856404;"><strong>💡 Don't miss out!</strong> Place a new bid to regain the lead.</p></div>` : `<div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;"><p style="margin: 0; color: #155724;"><strong>💡 Tip:</strong> Your automatic bidding is working! Consider increasing your max bid if you want more protection.</p></div>`}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, ${wasOutbid ? '#28a745' : '#72AEC8'} 0%, ${wasOutbid ? '#218838' : '#5a9ab8'} 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">${wasOutbid ? 'Place New Bid' : 'View Auction'}</a>
        </div>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Online Auction.</p>
    </div>`;
}

function buildRejectBidderEmailHtml(rejectedUser, product, sellerName, homeUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Bid Rejected</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>Dear <strong>${rejectedUser.fullname}</strong>,</p>
        <p>We regret to inform you that the seller has rejected your bid on the following product:</p>
        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
          <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${sellerName}</p>
        </div>
        <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
        <p style="color: #666;">You can still participate in other auctions on our platform.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${homeUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Browse Other Auctions</a>
        </div>
        <p style="color: #888; font-size: 13px;">If you believe this was done in error, please contact our support team.</p>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>
    </div>`;
}

// ============ MAIN FUNCTIONS ============

/**
 * Đặt bid (core business logic)
 * @returns {object} Kết quả bid bao gồm giá mới, winner, trạng thái sold, etc.
 */
export async function placeBid(productId, userId, bidAmount) {
  const result = await db.transaction(async (trx) => {
    const product = await trx('products')
      .where('id', productId)
      .forUpdate()
      .first();

    if (!product) throw new Error('Product not found');
    if (product.is_sold === true) throw new Error('This product has already been sold');

    await validateBidderEligibility(trx, productId, userId, product);

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (now > endDate) throw new Error('Auction has ended');

    const currentPrice = parseFloat(product.current_price || product.starting_price);
    if (bidAmount <= currentPrice) {
      throw new Error(`Bid must be higher than current price (${currentPrice.toLocaleString()} VND)`);
    }

    const minIncrement = parseFloat(product.step_price);
    if (bidAmount < currentPrice + minIncrement) {
      throw new Error(`Bid must be at least ${minIncrement.toLocaleString()} VND higher than current price`);
    }

    const previousHighestBidderId = product.highest_bidder_id;
    const previousPrice = parseFloat(product.current_price || product.starting_price);

    const extendedEndTime = await checkAutoExtend(product);
    if (extendedEndTime) product.end_at = extendedEndTime;

    const priceResult = calculateNewPrice(product, bidAmount, userId);

    const updateData = {
      current_price: priceResult.newCurrentPrice,
      highest_bidder_id: priceResult.newHighestBidderId,
      highest_max_price: priceResult.newHighestMaxPrice,
    };

    if (priceResult.buyNowTriggered) {
      updateData.end_at = new Date();
      updateData.closed_at = new Date();
    } else if (extendedEndTime) {
      updateData.end_at = extendedEndTime;
    }

    await trx('products').where('id', productId).update(updateData);

    if (priceResult.shouldCreateHistory) {
      await trx('bidding_history').insert({
        product_id: productId,
        bidder_id: priceResult.newHighestBidderId,
        current_price: priceResult.newCurrentPrice,
      });
    }

    await trx.raw(
      `INSERT INTO auto_bidding (product_id, bidder_id, max_price)
       VALUES (?, ?, ?)
       ON CONFLICT (product_id, bidder_id)
       DO UPDATE SET max_price = EXCLUDED.max_price, created_at = NOW()`,
      [productId, userId, bidAmount]
    );

    return {
      productId,
      newCurrentPrice: priceResult.newCurrentPrice,
      newHighestBidderId: priceResult.newHighestBidderId,
      userId,
      bidAmount,
      productSold: priceResult.buyNowTriggered,
      autoExtended: !!extendedEndTime,
      newEndTime: extendedEndTime,
      productName: product.name,
      sellerId: product.seller_id,
      previousHighestBidderId,
      previousPrice,
      priceChanged: previousPrice !== priceResult.newCurrentPrice,
    };
  });

  return result;
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
export async function rejectBidder(productId, bidderId, sellerId) {
  let rejectedBidderInfo = null;
  let productInfo = null;
  let sellerInfo = null;

  await db.transaction(async (trx) => {
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

    const autoBid = await trx('auto_bidding')
      .where('product_id', productId)
      .where('bidder_id', bidderId)
      .first();

    if (!autoBid) throw new Error('This bidder has not placed a bid on this product');

    rejectedBidderInfo = await trx('users').where('id', bidderId).first();
    productInfo = product;
    sellerInfo = await trx('users').where('id', sellerId).first();

    // Insert rejected record
    await trx('rejected_bidders')
      .insert({ product_id: productId, bidder_id: bidderId, seller_id: sellerId })
      .onConflict(['product_id', 'bidder_id'])
      .ignore();

    // Remove bidder's history and auto-bid
    await trx('bidding_history').where('product_id', productId).where('bidder_id', bidderId).del();
    await trx('auto_bidding').where('product_id', productId).where('bidder_id', bidderId).del();

    // Recalculate prices
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
  });

  return { rejectedUser: rejectedBidderInfo, product: productInfo, seller: sellerInfo };
}

/**
 * Gửi email thông báo reject bidder (fire-and-forget)
 */
export function sendRejectBidderEmail(rejectedUser, product, sellerName, homeUrl) {
  if (!rejectedUser?.email || !product) return;

  sendMail({
    to: rejectedUser.email,
    subject: `Your bid has been rejected: ${product.name}`,
    html: buildRejectBidderEmailHtml(rejectedUser, product, sellerName, homeUrl),
  })
    .then(() => console.log(`Rejection email sent to ${rejectedUser.email} for product #${product.id}`))
    .catch((err) => console.error('Failed to send rejection email:', err));
}

/**
 * Buy Now (mua ngay)
 */
export async function buyNow(productId, userId) {
  await db.transaction(async (trx) => {
    const product = await trx('products')
      .leftJoin('users as seller', 'products.seller_id', 'seller.id')
      .where('products.id', productId)
      .select('products.*', 'seller.fullname as seller_name')
      .first();

    if (!product) throw new Error('Product not found');
    if (product.seller_id === userId) throw new Error('Seller cannot buy their own product');

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (product.is_sold !== null) throw new Error('Product is no longer available');
    if (endDate <= now || product.closed_at) throw new Error('Auction has already ended');
    if (!product.buy_now_price) throw new Error('Buy Now option is not available for this product');

    const buyNowPrice = parseFloat(product.buy_now_price);

    const isRejected = await trx('rejected_bidders')
      .where({ product_id: productId, bidder_id: userId })
      .first();
    if (isRejected) throw new Error('You have been rejected from bidding on this product');

    if (!product.allow_unrated_bidder) {
      const ratingData = await reviewModel.calculateRatingPoint(userId);
      const ratingPoint = ratingData ? ratingData.rating_point : 0;
      if (ratingPoint === 0) throw new Error('This product does not allow bidders without ratings');
    }

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

export { sendBidNotificationEmails };