import * as biddingHistoryModel from '../models/biddingHistory.model.js';

export async function getBiddingHistory(productId) {
  return biddingHistoryModel.getBiddingHistory(productId);
}