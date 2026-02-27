/**
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function} Express middleware
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch((error) => {
      console.error(error);

      const status = getHttpStatus(error);
      res.status(status).json({ error: error.message });
    });
  };
}

function getHttpStatus(error) {
  const message = error.message || '';

  if (message === 'Unauthorized') return 403;
  if (message === 'Order not found') return 404;
  if (message === 'No payment invoice found') return 400;

  return 500;
}
