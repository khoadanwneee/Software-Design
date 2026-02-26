/**
 * Flash message middleware.
 * Automatically moves flash messages from session to res.locals
 * so they are available in all Handlebars templates, then clears them.
 */
export function flashMessages(req, res, next) {
  res.locals.success_message = req.session.success_message || null;
  res.locals.error_message = req.session.error_message || null;
  delete req.session.success_message;
  delete req.session.error_message;
  next();
}
