/**
 * Xây dựng URL sản phẩm từ request object
 * DRY-NEW-7: Thay vì lặp lại `${req.protocol}://${req.get('host')}/products/detail?id=${productId}` khắp nơi
 */
export function buildProductUrl(req, productId) {
  return `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
}
