export function formatVND(amount) {
  return new Intl.NumberFormat('en-US').format(amount);
}