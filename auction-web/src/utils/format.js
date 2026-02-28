export function formatVND(amount) {
  return new Intl.NumberFormat('en-US').format(amount);
}

/**
 * Format Date thành chuỗi "HH:mm:ss DD/MM/YYYY"
 * DRY-24: Tái sử dụng thay vì viết inline nhiều nơi
 */
export function formatDateTime(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
}