import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as productModel from '../models/product.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import { sendMail } from '../utils/mailer.js';
import { emailLayout } from '../utils/emailTemplates.js';
import { formatVND } from '../utils/format.js';

/**
 * ============================================
 * PRODUCT DESCRIPTION SERVICE
 * ============================================
 * Business logic cho cập nhật mô tả sản phẩm:
 * - Thêm mô tả mới + thông báo email
 * - Đọc danh sách updates
 */

export async function getDescriptionUpdates(productId) {
  return productDescUpdateModel.findByProductId(productId);
}

// additional wrappers to hide model access from controllers
export async function getUpdateById(updateId) {
  return productDescUpdateModel.findById(updateId);
}

export async function updateContent(updateId, content) {
  return productDescUpdateModel.updateContent(updateId, content);
}

export async function deleteUpdate(updateId) {
  return productDescUpdateModel.deleteUpdate(updateId);
}

/**
 * Thêm mô tả mới cho sản phẩm + gửi email thông báo cho bidders/commenters
 */
export async function appendDescriptionAndNotify({ productId, sellerId, description, productUrl }) {
  if (!description || description.trim() === '') {
    throw new Error('Description is required');
  }

  const product = await productModel.findByProductId2(productId, null);
  if (!product) throw new Error('Product not found');
  if (product.seller_id !== sellerId) throw new Error('Unauthorized');

  await productDescUpdateModel.addUpdate(productId, description.trim());

  // Fire-and-forget email
  sendDescriptionUpdateNotifications({ productId, sellerId, product, description: description.trim(), productUrl });

  return product;
}

/**
 * Gửi email thông báo cập nhật mô tả (fire-and-forget)
 */
function sendDescriptionUpdateNotifications({ productId, sellerId, product, description, productUrl }) {
  (async () => {
    try {
      const [bidders, commenters] = await Promise.all([
        biddingHistoryModel.getUniqueBidders(productId),
        productCommentModel.getUniqueCommenters(productId),
      ]);

      const notifyMap = new Map();
      [...bidders, ...commenters].forEach(user => {
        if (user.id !== sellerId && !notifyMap.has(user.email)) {
          notifyMap.set(user.email, user);
        }
      });

      const notifyUsers = Array.from(notifyMap.values());
      if (notifyUsers.length === 0) return;

      await Promise.all(
        notifyUsers.map(user =>
          sendMail({
            to: user.email,
            subject: `[Auction Update] New description added for "${product.name}"`,
            html: buildDescUpdateEmailHtml(user, product, description, productUrl),
          }).catch(err => console.error('Failed to send email to', user.email, err))
        )
      );
    } catch (err) {
      console.error('Email notification error:', err);
    }
  })();
}

function buildDescUpdateEmailHtml(user, product, description, productUrl) {
  const body = `
        <p>Hello <strong>${user.fullname}</strong>,</p>
        <p>The seller has added new information to the product description:</p>
        <div style="background: white; padding: 15px; border-left: 4px solid #72AEC8; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
          <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${formatVND(product.current_price)} VND</strong></p>
        </div>
        <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;"><i>✉</i> New Description Added:</p>
          <div style="color: #333;">${description}</div>
        </div>
        <p>View the product to see the full updated description:</p>
        <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0;">View Product</a>
        <p style="color: #999; font-size: 12px; margin-top: 15px;">You received this email because you placed a bid or asked a question on this product.</p>`;
  return emailLayout('Product Description Updated', body);
}