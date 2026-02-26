import * as productCommentModel from '../models/productComment.model.js';
import * as productModel from '../models/product.model.js';
import * as userModel from '../models/user.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import { sendCommentNotifications } from '../utils/commentNotification.js';

/**
 * ============================================
 * COMMENT SERVICE
 * ============================================
 * Business logic cho comment/Q&A:
 * - Lấy comments + replies (phân trang)
 * - Tạo comment + gửi email thông báo
 */

export async function getCommentsWithReplies(productId, page, perPage) {
  const offset = (page - 1) * perPage;

  const [comments, totalComments] = await Promise.all([
    productCommentModel.getCommentsByProductId(productId, perPage, offset),
    productCommentModel.countCommentsByProductId(productId)
  ]);

  if (comments.length === 0)
    return { comments, totalComments };

  const commentIds = comments.map(c => c.id);
  const replies = await productCommentModel.getRepliesByCommentIds(commentIds);

  const repliesMap = new Map();
  for (const r of replies) {
    if (!repliesMap.has(r.parent_id)) {
      repliesMap.set(r.parent_id, []);
    }
    repliesMap.get(r.parent_id).push(r);
  }

  comments.forEach(c => {
    c.replies = repliesMap.get(c.id) || [];
  });

  return { comments, totalComments };
}

/**
 * Tạo comment + gửi email thông báo
 * - Seller reply → notify tất cả bidder + commenter
 * - Bidder reply → notify seller
 * - Bidder question → notify seller
 */
export async function createCommentAndNotify({ productId, userId, content, parentId, productUrl }) {
  if (!content || content.trim().length === 0) {
    throw new Error('Comment cannot be empty');
  }

  await productCommentModel.createComment(productId, userId, content.trim(), parentId || null);

  // Fire-and-forget email notifications
  sendCommentNotifications({ productId, userId, content: content.trim(), parentId, productUrl });
}
