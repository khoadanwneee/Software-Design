import db from '../utils/db.js';

/**
 * ============================================
 * INVOICE MODEL
 * ============================================
 * Chỉ chứa DB queries cho bảng invoices.
 * Business logic (file upload) nằm ở invoice.service.js
 * 
 * 2 loại invoice:
 * - payment: Hóa đơn thanh toán từ buyer
 * - shipping: Hóa đơn vận chuyển từ seller
 */

/**
 * DRY fix: Generic insert invoice (merges insertPaymentInvoice + insertShippingInvoice)
 */
export async function insertInvoice(invoiceData) {
  const rows = await db('invoices').insert({
    ...invoiceData,
    is_verified: false,
    created_at: db.fn.now()
  }).returning('*');

  return rows[0];
}

// Backward-compatible wrappers
export function insertPaymentInvoice(data) {
  const { order_id, issuer_id, payment_method, payment_proof_urls, note } = data;
  return insertInvoice({ order_id, issuer_id, invoice_type: 'payment', payment_method, payment_proof_urls, note });
}

export function insertShippingInvoice(data) {
  const { order_id, issuer_id, tracking_number, shipping_provider, shipping_proof_urls, note } = data;
  return insertInvoice({ order_id, issuer_id, invoice_type: 'shipping', tracking_number, shipping_provider, shipping_proof_urls, note });
}

export const createPaymentInvoice = insertPaymentInvoice;
export const createShippingInvoice = insertShippingInvoice;

/**
 * Lấy invoice theo ID
 */
export async function findById(invoiceId) {
  return db('invoices')
    .where('id', invoiceId)
    .first();
}

/**
 * Lấy tất cả invoices của một order
 */
export async function findByOrderId(orderId) {
  return db('invoices')
    .leftJoin('users as issuer', 'invoices.issuer_id', 'issuer.id')
    .leftJoin('users as verifier', 'invoices.verified_by', 'verifier.id')
    .where('invoices.order_id', orderId)
    .select(
      'invoices.*',
      'issuer.fullname as issuer_name',
      'verifier.fullname as verifier_name'
    )
    .orderBy('invoices.created_at', 'desc');
}

/**
 * DRY fix: Generic invoice getter by type (merges getPaymentInvoice + getShippingInvoice)
 */
export async function getInvoiceByType(orderId, type) {
  return db('invoices')
    .leftJoin('users as issuer', 'invoices.issuer_id', 'issuer.id')
    .where('invoices.order_id', orderId)
    .where('invoices.invoice_type', type)
    .select(
      'invoices.*',
      'issuer.fullname as issuer_name'
    )
    .first();
}

// Backward-compatible aliases
export function getPaymentInvoice(orderId) {
  return getInvoiceByType(orderId, 'payment');
}

export function getShippingInvoice(orderId) {
  return getInvoiceByType(orderId, 'shipping');
}

/**
 * Xác minh invoice
 */
export async function verifyInvoice(invoiceId) {
  const rows = await db('invoices')
    .where('id', invoiceId)
    .update({
      is_verified: true,
      verified_at: db.fn.now(),
      updated_at: db.fn.now()
    })
    .returning('*');

  return rows[0];
}

/**
 * Cập nhật invoice
 */
export async function updateInvoice(invoiceId, updateData) {
  const rows = await db('invoices')
    .where('id', invoiceId)
    .update({
      ...updateData,
      updated_at: db.fn.now()
    })
    .returning('*');

  return rows[0];
}

/**
 * Xóa invoice
 */
export async function deleteInvoice(invoiceId) {
  return db('invoices')
    .where('id', invoiceId)
    .del();
}

/**
 * DRY fix: Generic has-invoice check (merges hasPaymentInvoice + hasShippingInvoice)
 */
export async function hasInvoiceByType(orderId, type) {
  const count = await db('invoices')
    .where('order_id', orderId)
    .where('invoice_type', type)
    .count('* as count')
    .first();

  return count.count > 0;
}

export function hasPaymentInvoice(orderId) {
  return hasInvoiceByType(orderId, 'payment');
}

export function hasShippingInvoice(orderId) {
  return hasInvoiceByType(orderId, 'shipping');
}

/**
 * Lấy tất cả invoices chưa xác minh
 */
export async function getUnverifiedInvoices() {
  return db('invoices')
    .leftJoin('orders', 'invoices.order_id', 'orders.id')
    .leftJoin('products', 'orders.product_id', 'products.id')
    .leftJoin('users as issuer', 'invoices.issuer_id', 'issuer.id')
    .where('invoices.is_verified', false)
    .select(
      'invoices.*',
      'products.name as product_name',
      'issuer.fullname as issuer_name'
    )
    .orderBy('invoices.created_at', 'desc');
}
