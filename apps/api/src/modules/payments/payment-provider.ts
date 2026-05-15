import crypto from "crypto";

const VNP_TMNCODE = "QE65RLIF";
const VNP_HASHSECRET = "C8M1OZFHKV7WXLGL1MB8IS4R9VWRI2OE";

// ⚠️ FIX: phải là endpoint full
const VNP_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

const VNP_RETURN_URL = process.env.VNP_RETURN_URL?.trim() ?? "";

function formatVnpDate(date = new Date()) {
  // VNPay expects local Vietnam time (GMT+7) in yyyyMMddHHmmss
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = vn.getUTCFullYear();
  const mm = String(vn.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(vn.getUTCDate()).padStart(2, "0");
  const hh = String(vn.getUTCHours()).padStart(2, "0");
  const mi = String(vn.getUTCMinutes()).padStart(2, "0");
  const ss = String(vn.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function encodeVnpValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

/**
 * VNPay uses sorted params and URL-encoded values
 * to build both signData and query string.
 */
function buildVnpParamString(params: Record<string, string | number>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeVnpValue(String(params[key]))}`)
    .join("&");
}

/**
 * HASH
 */
function createHash(data: string) {
  return crypto
    .createHmac("sha512", VNP_HASHSECRET)
    .update(Buffer.from(data, "utf-8"))
    .digest("hex");
}

/**
 * Remove fields not included in signature
 */
function getSignParams(params: Record<string, any>) {
  const clone = { ...params };
  delete clone.vnp_SecureHash;
  delete clone.vnp_SecureHashType;
  return clone;
}

export const paymentProvider = {
  async createSession(input: {
    registrationId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }) {
    const orderId = `${input.registrationId}-${Date.now()}`;

    const params: Record<string, string | number> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: VNP_TMNCODE,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",

      vnp_TxnRef: orderId,
      vnp_OrderInfo: `UNIHUB_${orderId}`,
      vnp_OrderType: "other",

      vnp_Amount: Math.round(input.amount * 100).toString(),

      vnp_ReturnUrl: VNP_RETURN_URL,

      vnp_IpAddr: "127.0.0.1",

      vnp_CreateDate: formatVnpDate(),
    };

    // SIGN PARAMS
    const signParams = getSignParams(params);

    const signData = buildVnpParamString(signParams);

    console.log("SIGN STRING:", signData);

    const secureHash = createHash(signData);

    const queryString = buildVnpParamString(params);

    const paymentUrl =
      `${VNP_URL}?${queryString}&vnp_SecureHash=${secureHash}&vnp_SecureHashType=HMACSHA512`;

    return {
      providerOrderId: orderId,
      paymentUrl,
    };
  },

  async verifyWebhook(query: any) {
    const secureHash = query.vnp_SecureHash;

    const data = { ...query };
    delete data.vnp_SecureHash;
    delete data.vnp_SecureHashType;

    const signData = buildVnpParamString(data);
    const checkHash = createHash(signData);

    return {
      valid: secureHash === checkHash,
      providerOrderId: query.vnp_TxnRef,
      providerTransactionId: query.vnp_TransactionNo,
      status: query.vnp_ResponseCode === "00" ? "success" : "failed",
    };
  },
};
