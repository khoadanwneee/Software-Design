import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as invoiceModel from '../models/invoice.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ============================================
 * INVOICE SERVICE
 * ============================================
 * Business logic cho hóa đơn:
 * - Di chuyển file upload từ thư mục tạm sang thư mục cố định
 * - Tạo payment/shipping invoice kèm xử lý file
 */

/**
 * Move uploaded files from temp folder to permanent folder
 * @param {Array} tempUrls - Array of temp URLs like ["uploads/123.jpg"]
 * @param {String} type - 'payment_proofs' or 'shipping_proofs'
 * @returns {Array} - Array of permanent URLs like ["images/payment_proofs/123.jpg"]
 */
export function moveUploadedFiles(tempUrls, type) {
  if (!tempUrls || tempUrls.length === 0) return [];

  const publicPath = path.join(__dirname, '..', 'public');
  const targetPath = path.join(publicPath, 'images', type);

  // Create target folder if not exists
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  const permanentUrls = [];

  for (const tempUrl of tempUrls) {
    const tempFilename = path.basename(tempUrl);
    const tempFilePath = path.join(publicPath, tempUrl);

    const ext = path.extname(tempFilename);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const newFilename = `${timestamp}-${random}${ext}`;

    const newPath = path.join(targetPath, newFilename);
    const newUrl = `images/${type}/${newFilename}`;

    try {
      if (fs.existsSync(tempFilePath)) {
        fs.renameSync(tempFilePath, newPath);
        permanentUrls.push(newUrl);
      } else {
        console.warn(`Temp file not found: ${tempFilePath}`);
      }
    } catch (error) {
      console.error(`Error moving file ${tempUrl}:`, error);
    }
  }

  return permanentUrls;
}

/**
 * DRY fix: Generic invoice creator (merges createPaymentInvoice + createShippingInvoice)
 * Handles file move + DB insert for any invoice type.
 */
async function createInvoice(invoiceData, proofField, proofFolder) {
  if (invoiceData[proofField]) {
    invoiceData[proofField] = moveUploadedFiles(invoiceData[proofField], proofFolder);
  }
  return invoiceModel.insertInvoice(invoiceData);
}

/**
 * Tạo hóa đơn thanh toán (buyer) — move file + insert DB
 */
export async function createPaymentInvoice(invoiceData) {
  const { order_id, issuer_id, payment_method, payment_proof_urls, note } = invoiceData;
  return createInvoice(
    { order_id, issuer_id, invoice_type: 'payment', payment_method, payment_proof_urls, note },
    'payment_proof_urls',
    'payment_proofs'
  );
}

/**
 * Tạo hóa đơn vận chuyển (seller) — move file + insert DB
 */
export async function createShippingInvoice(invoiceData) {
  const { order_id, issuer_id, tracking_number, shipping_provider, shipping_proof_urls, note } = invoiceData;
  return createInvoice(
    { order_id, issuer_id, invoice_type: 'shipping', tracking_number, shipping_provider, shipping_proof_urls, note },
    'shipping_proof_urls',
    'shipping_proofs'
  );
}
