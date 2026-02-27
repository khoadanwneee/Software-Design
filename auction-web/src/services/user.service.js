import * as userModel from '../models/user.model.js';

/**
 * USER SERVICE
 * Provides a thin abstraction layer over user.model.js so that
 * controllers interact with services instead of models directly.
 * Additional business logic may be added here in the future.
 */

export async function add(userData) {
  return userModel.add(userData);
}

export function findById(id) {
  return userModel.findById(id);
}

export function loadAllUsers() {
  return userModel.loadAllUsers();
}

export function findUsersByRole(role) {
  return userModel.findUsersByRole(role);
}

export function update(id, updateData) {
  return userModel.update(id, updateData);
}

export function findByEmail(email) {
  return userModel.findByEmail(email);
}

// OTP helpers
export function createOtp(opts) {
  return userModel.createOtp(opts);
}

export function findValidOtp(opts) {
  return userModel.findValidOtp(opts);
}

export function markOtpUsed(id) {
  return userModel.markOtpUsed(id);
}

export function verifyUserEmail(userId) {
  return userModel.verifyUserEmail(userId);
}

export function markUpgradePending(userId) {
  return userModel.markUpgradePending(userId);
}

export function updateUserRoleToSeller(userId) {
  return userModel.updateUserRoleToSeller(userId);
}

export function deleteUser(id) {
  return userModel.deleteUser(id);
}

export function findByOAuthProvider(provider, oauthId) {
  return userModel.findByOAuthProvider(provider, oauthId);
}

export function addOAuthProvider(userId, provider, oauthId) {
  return userModel.addOAuthProvider(userId, provider, oauthId);
}
