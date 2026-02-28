import { sendMail } from './mailer.js';
import { emailLayout } from './emailTemplates.js';
import { formatVND } from './format.js';
import { getProductNotificationRecipients } from './notificationRecipients.js';



/**
 * Gửi email thông báo cập nhật mô tả (fire-and-forget)
 */
export function sendDescriptionUpdateNotifications({ productId, sellerId, product, description, productUrl }) {
  (async () => {
    try {
      const notifyUsers = await getProductNotificationRecipients(productId, sellerId);
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