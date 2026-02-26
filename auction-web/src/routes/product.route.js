import express from 'express';
import multer from 'multer';
import path from 'path';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import * as productController from '../controllers/product.controller.js';

const router = express.Router();

// Multer storage config for order image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, gif) are accepted!'));
    }
  }
});

// Product listing and search
router.get('/category', productController.getCategory);
router.get('/search', productController.getSearch);
router.get('/detail', productController.getDetail);

// Bidding history
router.get('/bidding-history', isAuthenticated, productController.getBiddingHistory);

// Watchlist
router.post('/watchlist', isAuthenticated, productController.postWatchlist);
router.delete('/watchlist', isAuthenticated, productController.deleteWatchlist);

// Bidding
router.post('/bid', isAuthenticated, productController.postBid);

// Comments
router.post('/comment', isAuthenticated, productController.postComment);

// Bid history API
router.get('/bid-history/:productId', productController.getBidHistory);

// Complete order
router.get('/complete-order', isAuthenticated, productController.getCompleteOrder);

// Image upload for payment/shipping proofs
router.post('/order/upload-images', isAuthenticated, upload.array('images', 5), productController.postUploadImages);

// Order payment and shipping routes
router.post('/order/:orderId/submit-payment', isAuthenticated, productController.postSubmitPayment);
router.post('/order/:orderId/confirm-payment', isAuthenticated, productController.postConfirmPayment);
router.post('/order/:orderId/submit-shipping', isAuthenticated, productController.postSubmitShipping);
router.post('/order/:orderId/confirm-delivery', isAuthenticated, productController.postConfirmDelivery);
router.post('/order/:orderId/submit-rating', isAuthenticated, productController.postSubmitRating);
router.post('/order/:orderId/complete-transaction', isAuthenticated, productController.postCompleteTransaction);
router.post('/order/:orderId/send-message', isAuthenticated, productController.postSendMessage);
router.get('/order/:orderId/messages', isAuthenticated, productController.getOrderMessages);

// Reject/Unreject bidder
router.post('/reject-bidder', isAuthenticated, productController.postRejectBidder);
router.post('/unreject-bidder', isAuthenticated, productController.postUnrejectBidder);

// Buy now
router.post('/buy-now', isAuthenticated, productController.postBuyNow);

// Ratings pages (DRY: dùng chung createGetUserRatings thay vì 2 handler riêng)
router.get('/seller/:sellerId/ratings', productController.createGetUserRatings('seller'));
router.get('/bidder/:bidderId/ratings', productController.createGetUserRatings('bidder'));

export default router;
