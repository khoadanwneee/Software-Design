import * as upgradeRequestModel from '../models/upgradeRequest.model.js';

/**
 * SERVICE FOR UPGRADE REQUESTS
 */

export function findByUserId(bidderId) {
  return upgradeRequestModel.findByUserId(bidderId);
}

export function createUpgradeRequest(bidderId) {
  return upgradeRequestModel.createUpgradeRequest(bidderId);
}

export function loadAllUpgradeRequests() {
  return upgradeRequestModel.loadAllUpgradeRequests();
}

export function approveUpgradeRequest(requestId) {
  return upgradeRequestModel.approveUpgradeRequest(requestId);
}

export function rejectUpgradeRequest(requestId, adminNote) {
  return upgradeRequestModel.rejectUpgradeRequest(requestId, adminNote);
}
