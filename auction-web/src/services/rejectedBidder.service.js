import * as rejectedBidderModel from '../models/rejectedBidder.model.js';

export async function getRejectedBidders(productId) {
  return rejectedBidderModel.getRejectedBidders(productId);
}