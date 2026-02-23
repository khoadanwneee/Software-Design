import express from 'express';
import passport from '../utils/passport.js';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import * as accountController from '../controllers/account.controller.js';

const router = express.Router();

// Ratings
router.get('/ratings', isAuthenticated, accountController.getRatings);

// Auth routes
router.get('/signup', accountController.getSignup);
router.get('/signin', accountController.getSignin);
router.get('/verify-email', accountController.getVerifyEmail);
router.get('/forgot-password', accountController.getForgotPassword);
router.post('/forgot-password', accountController.postForgotPassword);
router.post('/verify-forgot-password-otp', accountController.postVerifyForgotPasswordOtp);
router.post('/resend-forgot-password-otp', accountController.postResendForgotPasswordOtp);
router.post('/reset-password', accountController.postResetPassword);
router.post('/signin', accountController.postSignin);
router.post('/signup', accountController.postSignup);
router.post('/verify-email', accountController.postVerifyEmail);
router.post('/resend-otp', accountController.postResendOtp);

// Profile
router.get('/profile', isAuthenticated, accountController.getProfile);
router.put('/profile', isAuthenticated, accountController.putProfile);

// Logout
router.post('/logout', isAuthenticated, accountController.postLogout);

// Upgrade request
router.get('/request-upgrade', isAuthenticated, accountController.getRequestUpgrade);
router.post('/request-upgrade', isAuthenticated, accountController.postRequestUpgrade);

// Watchlist
router.get('/watchlist', isAuthenticated, accountController.getWatchlist);

// Bidding
router.get('/bidding', isAuthenticated, accountController.getBidding);

// Won Auctions
router.get('/auctions', isAuthenticated, accountController.getAuctions);

// Rate Seller
router.post('/won-auctions/:productId/rate-seller', isAuthenticated, accountController.postRateSeller);
router.put('/won-auctions/:productId/rate-seller', isAuthenticated, accountController.putRateSeller);

// Seller pages
router.get('/seller/products', isAuthenticated, accountController.getSellerProducts);
router.get('/seller/sold-products', isAuthenticated, accountController.getSellerSoldProducts);

// OAuth Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/account/signin' }), accountController.oauthCallback);

router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['public_profile'] }));
router.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/account/signin' }), accountController.oauthCallback);

router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/account/signin' }), accountController.oauthCallback);

export default router;
