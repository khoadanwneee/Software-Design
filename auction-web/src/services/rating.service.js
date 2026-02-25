import * as reviewModel from '../models/review.model.js';

export async function getUserRating(userId) {
  const ratingObject = await reviewModel.calculateRatingPoint(userId);
  const reviews = await reviewModel.getReviewsByUserId(userId);

  return {
    rating_point: ratingObject.rating_point,
    has_reviews: reviews.length > 0
  };
}