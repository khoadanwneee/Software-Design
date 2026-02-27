import * as reviewModel from '../models/review.model.js';

/**
 * ============================================
 * RATING SERVICE
 * ============================================
 * Business logic cho đánh giá:
 * - Tính điểm rating
 * - Aggregation positive/negative
 * - Create-or-update review pattern
 * - Lấy thông tin đầy đủ cho trang ratings
 */

/**
 * Lấy rating point và trạng thái đánh giá của user
 */
export async function getUserRating(userId) {
  const ratingObject = await reviewModel.calculateRatingPoint(userId);
  const reviews = await reviewModel.getReviewsByUserId(userId);

  return {
    rating_point: ratingObject.rating_point,
    has_reviews: reviews.length > 0
  };
}

/**
 * Lấy thông tin đầy đủ cho trang ratings
 * (Consolidate logic duplicate từ account.controller, product.controller)
 */
export async function getRatingDetails(userId) {
  const ratingData = await reviewModel.calculateRatingPoint(userId);
  const rating_point = ratingData ? ratingData.rating_point : 0;
  const reviews = await reviewModel.getReviewsByUserId(userId);

  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter(r => r.rating === 1).length;
  const negativeReviews = reviews.filter(r => r.rating === -1).length;

  return {
    rating_point,
    reviews,
    totalReviews,
    positiveReviews,
    negativeReviews,
  };
}

/**
 * Create hoặc update review (pattern dùng chung cho cả buyer rate seller và seller rate bidder)
 * @param {number} reviewerId - ID người đánh giá
 * @param {number} revieweeId - ID người được đánh giá
 * @param {number} productId - ID sản phẩm
 * @param {string} rating - 'positive' hoặc 'negative'
 * @param {string|null} comment - Bình luận
 */
export async function createOrUpdateReview(reviewerId, revieweeId, productId, rating, comment = null) {
  const ratingValue = rating === 'positive' ? 1 : -1;

  const existingReview = await reviewModel.findByReviewerAndProduct(
    reviewerId,
    productId
  );

  if (existingReview) {
    await reviewModel.updateByReviewerAndProduct(reviewerId, productId, {
      rating: ratingValue,
      comment: comment || null,
    });
  } else {
    await reviewModel.create({
      reviewer_id: reviewerId,
      reviewed_user_id: revieweeId,
      product_id: productId,
      rating: ratingValue,
      comment: comment || null,
    });
  }
}

/**
 * Submit rating trong order flow
 */
export async function submitOrderRating(orderId, userId, rating, comment, order) {
  const isBuyer = order.buyer_id === userId;
  const reviewerId = userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

  await createOrUpdateReview(reviewerId, revieweeId, order.product_id, rating, comment);
}

// ------------------------------------------------------------------
// direct review access wrappers
// ------------------------------------------------------------------

export function getProductReview(reviewerId, revieweeId, productId) {
  return reviewModel.getProductReview(reviewerId, revieweeId, productId);
}

export function findByReviewerAndProduct(reviewerId, productId) {
  return reviewModel.findByReviewerAndProduct(reviewerId, productId);
}
/**
 * Tạo review với rating=0 (skip rating) — chỉ tạo nếu chưa tồn tại
 * Dùng khi user chọn "complete transaction" mà không đánh giá
 */
export async function createSkipReview(reviewerId, revieweeId, productId) {
  const existingReview = await reviewModel.findByReviewerAndProduct(
    reviewerId,
    productId
  );

  if (!existingReview) {
    await reviewModel.create({
      reviewer_id: reviewerId,
      reviewed_user_id: revieweeId,
      product_id: productId,
      rating: 0,
      comment: null,
    });
  }
}