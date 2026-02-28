import * as orderModel from '../models/order.model.js';
import * as invoiceModel from '../models/invoice.model.js';
import * as orderChatModel from '../models/orderChat.model.js';
import * as reviewModel from '../models/review.model.js';
import * as productModel from '../models/product.model.js';
import * as ratingService from './rating.service.js';
import db from '../utils/db.js';
import { formatDateTime } from '../utils/format.js';

/**
 * ============================================
 * ORDER SERVICE
 * ============================================
 * Business logic cho quy trình đơn hàng:
 * - Tạo order tự động khi auction kết thúc
 * - Quản lý trạng thái đơn hàng
 * - Kiểm tra quyền truy cập
 * - Hoàn tất giao dịch
 */

/**
 * Lấy order với kiểm tra quyền truy cập
 * @param {number} orderId - ID của order
 * @param {number} userId - ID của user đang thực hiện
 * @param {'buyer'|'seller'|null} requiredRole - Role yêu cầu (null = buyer hoặc seller đều được)
 * @returns {object} order object nếu authorized
 * @throws {Error} nếu order không tồn tại hoặc user không có quyền
 */
async function getOrderWithAuth(orderId, userId, requiredRole = null) {
  const order = await orderModel.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (requiredRole === 'buyer' && order.buyer_id !== userId)
    throw new Error('Unauthorized');
  if (requiredRole === 'seller' && order.seller_id !== userId)
    throw new Error('Unauthorized');
  if (!requiredRole && order.buyer_id !== userId && order.seller_id !== userId)
    throw new Error('Unauthorized');
  return order;
}

/**
 * Parse PostgreSQL array string thành JavaScript array
 * Ví dụ: "{url1,url2}" → ["url1", "url2"]
 */
function parsePostgresArray(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .replace(/^\{/, '')
      .replace(/\}$/, '')
      .split(',')
      .filter(url => url);
  }
  return value;
}

/**
 * Lấy hoặc tạo order cho một sản phẩm đã kết thúc đấu giá
 */
export async function getOrCreateOrder(productId, product) {
  let order = await orderModel.findByProductId(productId);

  if (!order) {
    const orderData = {
      product_id: productId,
      buyer_id: product.highest_bidder_id,
      seller_id: product.seller_id,
      final_price: product.current_price || product.highest_bid || 0,
    };
    await orderModel.createOrder(orderData);
    order = await orderModel.findByProductId(productId);
  }

  return order;
}

/**
 * Lấy thông tin đầy đủ của order (invoice, messages, parsed URLs)
 */
export async function getOrderDetails(orderId) {
  let paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
  let shippingInvoice = await invoiceModel.getShippingInvoice(orderId);

  if (paymentInvoice && paymentInvoice.payment_proof_urls) {
    paymentInvoice.payment_proof_urls = parsePostgresArray(
      paymentInvoice.payment_proof_urls
    );
  }

  if (shippingInvoice && shippingInvoice.shipping_proof_urls) {
    shippingInvoice.shipping_proof_urls = parsePostgresArray(
      shippingInvoice.shipping_proof_urls
    );
  }

  const messages = await orderChatModel.getMessagesByOrderId(orderId);

  return { paymentInvoice, shippingInvoice, messages };
}

/**
 * Kiểm tra user có quyền truy cập order không
 */
export async function canUserAccessOrder(orderId, userId) {
  return orderModel.canUserAccessOrder(orderId, userId);
}

/**
 * Kiểm tra xem cả buyer và seller đã rate chưa.
 * Nếu cả hai đã rate → hoàn tất order + đánh dấu product đã bán
 */
export async function checkAndCompleteOrder(orderId, userId) {
  const order = await orderModel.findById(orderId);
  if (!order) return false;

  const buyerReview = await reviewModel.getProductReview(
    order.buyer_id,
    order.seller_id,
    order.product_id
  );
  const sellerReview = await reviewModel.getProductReview(
    order.seller_id,
    order.buyer_id,
    order.product_id
  );

  if (buyerReview && sellerReview) {
    await orderModel.updateStatus(orderId, 'completed', userId);
    await productModel.updateProduct(order.product_id, {
      is_sold: true,
      closed_at: new Date(),
    });
    return true;
  }

  return false;
}

/**
 * Submit payment (buyer gửi chứng từ thanh toán)
 */
export async function submitPayment(orderId, userId, paymentData) {
  const order = await getOrderWithAuth(orderId, userId, 'buyer');

  const { payment_method, payment_proof_urls, note, shipping_address, shipping_phone } = paymentData;

  await invoiceModel.createPaymentInvoice({
    order_id: orderId,
    issuer_id: userId,
    payment_method,
    payment_proof_urls,
    note,
  });

  await orderModel.updateShippingInfo(orderId, {
    shipping_address,
    shipping_phone,
  });

  await orderModel.updateStatus(orderId, 'payment_submitted', userId);
}

/**
 * Confirm payment (seller xác nhận đã nhận tiền)
 */
export async function confirmPayment(orderId, userId) {
  const order = await getOrderWithAuth(orderId, userId, 'seller');

  const paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
  if (!paymentInvoice) {
    throw new Error('No payment invoice found');
  }

  await invoiceModel.verifyInvoice(paymentInvoice.id);
  await orderModel.updateStatus(orderId, 'payment_confirmed', userId);
}

/**
 * Submit shipping (seller gửi thông tin vận chuyển)
 */
export async function submitShipping(orderId, userId, shippingData) {
  const order = await getOrderWithAuth(orderId, userId, 'seller');

  const { tracking_number, shipping_provider, shipping_proof_urls, note } = shippingData;

  await invoiceModel.createShippingInvoice({
    order_id: orderId,
    issuer_id: userId,
    tracking_number,
    shipping_provider,
    shipping_proof_urls,
    note,
  });

  await orderModel.updateStatus(orderId, 'shipped', userId);
}

/**
 * Confirm delivery (buyer xác nhận đã nhận hàng)
 */
export async function confirmDelivery(orderId, userId) {
  const order = await getOrderWithAuth(orderId, userId, 'buyer');

  await orderModel.updateStatus(orderId, 'delivered', userId);
}

/**
 * Submit rating cho order (buyer hoặc seller đánh giá)
 */
export async function submitRating(orderId, userId, { rating, comment }) {
  const order = await getOrderWithAuth(orderId, userId);

  const isBuyer = order.buyer_id === userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

  await ratingService.createOrUpdateReview(userId, revieweeId, order.product_id, rating, comment);

  await checkAndCompleteOrder(orderId, userId);
}

/**
 * Complete transaction (skip rating)
 */
export async function completeTransaction(orderId, userId) {
  const order = await getOrderWithAuth(orderId, userId);

  const isBuyer = order.buyer_id === userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

  await ratingService.createSkipReview(userId, revieweeId, order.product_id);

  await checkAndCompleteOrder(orderId, userId);
}

/**
 * Send message trong order chat
 */
export async function sendMessage(orderId, userId, message) {
  const order = await getOrderWithAuth(orderId, userId);

  await orderChatModel.sendMessage({
    order_id: orderId,
    sender_id: userId,
    message,
  });
}

/**
 * Format messages thành HTML (cho API response)
 */
export function formatMessagesHtml(messages, currentUserId) {
  let messagesHtml = '';
  messages.forEach((msg) => {
    const isSent = msg.sender_id === currentUserId;
    const messageClass = isSent ? 'text-end' : '';
    const bubbleClass = isSent ? 'sent' : 'received';

    const msgDate = new Date(msg.created_at);
    const formattedDate = formatDateTime(msgDate);

    messagesHtml += `
      <div class="chat-message ${messageClass}">
        <div class="chat-bubble ${bubbleClass}">
          <div>${msg.message}</div>
          <div style="font-size: 0.7rem; margin-top: 3px; opacity: 0.8;">${formattedDate}</div>
        </div>
      </div>
    `;
  });
  return messagesHtml;
}

/**
 * Lấy messages đã format HTML (bao gồm auth check)
 */
export async function getFormattedMessages(orderId, userId) {
  const order = await getOrderWithAuth(orderId, userId);

  const messages = await orderChatModel.getMessagesByOrderId(orderId);
  return formatMessagesHtml(messages, userId);
}
