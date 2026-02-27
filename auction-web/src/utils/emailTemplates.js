const EMAIL_FOOTER = `
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>`;

/**
 * @param {string} headerTitle - Text in the gradient header bar
 * @param {string} bodyHtml   - Inner HTML for the body section
 * @param {string} headerColor    - Gradient start color (default: brand teal)
 * @param {string} headerColorEnd - Gradient end color
 */
export function emailLayout(headerTitle, bodyHtml, headerColor = '#72AEC8', headerColorEnd = '#5a9ab8') {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColorEnd} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${headerTitle}</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        ${bodyHtml}
      </div>${EMAIL_FOOTER}
    </div>`;
}

/**
 * @param {string} headerTitle - Text rendered as an h2
 * @param {string} bodyHtml   - Inner HTML body
 * @param {string} headerColor - h2 text color (default: purple-ish)
 */
export function emailSimpleLayout(headerTitle, bodyHtml, headerColor = '#667eea') {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${headerColor};">${headerTitle}</h2>
      ${bodyHtml}${EMAIL_FOOTER}
    </div>`;
}
