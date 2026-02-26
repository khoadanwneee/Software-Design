import * as productModel from '../models/product.model.js';
import * as userModel from '../models/user.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import { sendMail } from './mailer.js';

/**
 * Fire-and-forget notification logic previously embedded in comment.service.
 * Accepts the same argument object used by createCommentAndNotify.
 */
export async function sendCommentNotifications({ productId, userId, content, parentId, productUrl }) {
  (async () => {
    try {
      const product = await productModel.findByProductId2(productId, null);
      const commenter = await userModel.findById(userId);
      const seller = await userModel.findById(product.seller_id);

      const isSellerReplying = userId === product.seller_id;

      if (isSellerReplying && parentId) {
        // Seller trả lời → gửi cho tất cả bidders + commenters
        const [bidders, commenters] = await Promise.all([
          biddingHistoryModel.getUniqueBidders(productId),
          productCommentModel.getUniqueCommenters(productId),
        ]);

        const recipientsMap = new Map();
        bidders.forEach(b => {
          if (b.id !== product.seller_id && b.email) recipientsMap.set(b.id, b);
        });
        commenters.forEach(c => {
          if (c.id !== product.seller_id && c.email) recipientsMap.set(c.id, c);
        });

        const emailPromises = [];
        for (const [, recipient] of recipientsMap) {
          emailPromises.push(
            sendMail({
              to: recipient.email,
              subject: `Seller answered a question on: ${product.name}`,
              html: buildSellerReplyEmailHtml(recipient, seller, product, content, productUrl),
            }).catch(err => console.error(`Failed to send email to ${recipient.email}:`, err))
          );
        }

        await Promise.all(emailPromises);
        console.log(`Seller reply notification sent to ${recipientsMap.size} recipients`);
      } else if (seller?.email && userId !== product.seller_id) {
        // Bidder comment/reply → gửi cho seller
        const subject = parentId
          ? `New reply on your product: ${product.name}`
          : `New question about your product: ${product.name}`;

        await sendMail({
          to: seller.email,
          subject,
          html: buildBidderCommentEmailHtml(seller, commenter, product, content, parentId, productUrl),
        });
      }
    } catch (emailError) {
      console.error('Failed to send comment notification:', emailError);
    }
  })();
}

// ============ EMAIL TEMPLATES ============

function buildSellerReplyEmailHtml(recipient, seller, product, content, productUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">Seller Response on Product</h2>
      <p>Dear <strong>${recipient.fullname}</strong>,</p>
      <p>The seller has responded to a question on a product you're interested in:</p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>Seller:</strong> ${seller.fullname}</p>
        <p><strong>Answer:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">${content}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Product</a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">This is an automated message from Online Auction. Please do not reply to this email.</p>
    </div>`;
}

function buildBidderCommentEmailHtml(seller, commenter, product, content, parentId, productUrl) {
  const title = parentId ? 'New Reply on Your Product' : 'New Question About Your Product';
  const label = parentId ? 'Reply' : 'Question';
  const btnText = parentId ? 'View Product & Reply' : 'View Product & Answer';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">${title}</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>From:</strong> ${commenter.fullname}</p>
        <p><strong>${label}:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px;">${content}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">${btnText}</a>
      </div>
    </div>`;
}