import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';

/**
 * Lấy danh sách recipients (bidders + commenters) cho một sản phẩm,
 * trừ user được chỉ định (thường là seller hoặc người tạo event).
 * DRY-22: Dùng chung cho commentNotification.js và productDescription.service.js
 */
export async function getProductNotificationRecipients(productId, excludeUserId) {
  const [bidders, commenters] = await Promise.all([
    biddingHistoryModel.getUniqueBidders(productId),
    productCommentModel.getUniqueCommenters(productId),
  ]);

  const recipientsMap = new Map();
  [...bidders, ...commenters].forEach(user => {
    if (user.id !== excludeUserId && user.email && !recipientsMap.has(user.id)) {
      recipientsMap.set(user.id, user);
    }
  });

  return Array.from(recipientsMap.values());
}
