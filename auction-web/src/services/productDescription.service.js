import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';

export async function getDescriptionUpdates(productId) {
  return productDescUpdateModel.findByProductId(productId);
}