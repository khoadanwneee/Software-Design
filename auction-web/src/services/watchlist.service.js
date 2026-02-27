import * as watchlistModel from '../models/watchlist.model.js';

/**
 * WATCHLIST SERVICE
 */

export function searchPageByUserId(userId, limit, offset) {
  return watchlistModel.searchPageByUserId(userId, limit, offset);
}

export function countByUserId(userId) {
  return watchlistModel.countByUserId(userId);
}

export function isInWatchlist(userId, productId) {
  return watchlistModel.isInWatchlist(userId, productId);
}

export function addToWatchlist(userId, productId) {
  return watchlistModel.addToWatchlist(userId, productId);
}

export function removeFromWatchlist(userId, productId) {
  return watchlistModel.removeFromWatchlist(userId, productId);
}
