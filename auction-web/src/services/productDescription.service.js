import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as productModel from '../models/product.model.js';
import { sendDescriptionUpdateNotifications } from '../utils/updateDescNotification.js';

/**
 * ============================================
 * PRODUCT DESCRIPTION SERVICE
 * ============================================
 * Business logic cho cập nhật mô tả sản phẩm:
 * - Thêm mô tả mới + thông báo email
 * - Đọc danh sách updates
 */

export async function getDescriptionUpdates(productId) {
  return productDescUpdateModel.findByProductId(productId);
}

// additional wrappers to hide model access from controllers
export async function getUpdateById(updateId) {
  return productDescUpdateModel.findById(updateId);
}

export async function updateContent(updateId, content) {
  return productDescUpdateModel.updateContent(updateId, content);
}

export async function deleteUpdate(updateId) {
  return productDescUpdateModel.deleteUpdate(updateId);
}

/**
 * Thêm mô tả mới cho sản phẩm + gửi email thông báo cho bidders/commenters
 */
export async function appendDescriptionAndNotify({ productId, sellerId, description, productUrl }) {
  if (!description || description.trim() === '') {
    throw new Error('Description is required');
  }

  const product = await productModel.findByProductId2(productId, null);
  if (!product) throw new Error('Product not found');
  if (product.seller_id !== sellerId) throw new Error('Unauthorized');

  await productDescUpdateModel.addUpdate(productId, description.trim());

  // Fire-and-forget email
  sendDescriptionUpdateNotifications({ productId, sellerId, product, description: description.trim(), productUrl });

  return product;
}


