/**
 * ============================================
 * BID NOTIFICATION EMAILS
 * ============================================
 * Email templates & sending logic cho bidding notifications
 */

import * as userModel from '../models/user.model.js';
import { sendMail } from './mailer.js';

// ============ HELPERS ============

function formatVND(amount) {
  return new Intl.NumberFormat('en-US').format(amount);
}

// ============ EMAIL TEMPLATES ============

/**
 * Email cho seller khi có bid mới
 */
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

/**
 * Email cho bidder khi đặt bid
 */
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

/**
 * Email cho bidder cũ khi bị outbid hoặc giá thay đổi
 */
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

/**
 * Email khi bidder bị reject
 */
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

// ============ SENDING FUNCTIONS ============

/**
 * Gửi email thông báo bid cho seller, bidder hiện tại, và bidder cũ
 */
export function sendBidNotificationEmails(result, productUrl) {
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
