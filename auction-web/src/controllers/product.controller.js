import * as productModel from '../models/product.model.js';
import * as userModel from '../models/user.model.js';
import * as watchListModel from '../models/watchlist.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as categoryModel from '../models/category.model.js';
import * as rejectedBidderModel from '../models/rejectedBidder.model.js';
import * as categoryService from '../services/category.service.js';
import * as productService from '../services/product.service.js';
import * as orderService from '../services/order.service.js';
import * as ratingService from '../services/rating.service.js';
import * as biddingService from '../services/bidding.service.js';
import * as commentService from '../services/comment.service.js';
import { getPagination} from '../utils/pagination.js';
import { prepareProductList } from '../services/product.service.js';



export const getCategory = async (req, res) => {
  const userId = req.session.authUser?.id || null;
  const categoryId = req.query.catid;
  const sort = req.query.sort || '';

  const categoryData =
    await categoryService.getCategoryWithResolvedIds(categoryId);

  if (!categoryData) {
    return res.status(404).render('404');
  }

  const data = await productService.getProductByCategory({
    categoryIds: categoryData.categoryIds,
    category: categoryData.category,
    currentPage: (req.query.page || 1),
    sort,
    userId
  });

  res.render('vwProduct/list', data);
};

export const getSearch = async (req, res) => {
  const userId = req.session.authUser?.id || null;

  const q = req.query.q || '';
  const logic = req.query.logic || 'and';
  const sort = req.query.sort || '';

  const result = await productService.getSearchProducts({
    q,
    currentPage: (req.query.page || 1),
    userId,
    logic,
    sort
  });
  
  res.render('vwProduct/list', {
    ...result,
    q,
    logic,
    sort
  });
};



export const getDetail = async (req, res) => {
  const userId = req.session.authUser?.id || null;
  const productId = req.query.id;
  const commentPage = parseInt(req.query.commentPage) || 1;

  const viewModel =
    await productService.getProductDetail(
      productId,
      userId,
      commentPage
    );

  if (!viewModel)
    return res.status(404).render('404');

  res.render('vwProduct/details', {
    ...viewModel,
    authUser: req.session.authUser,
    success_message: req.session.success_message,
    error_message: req.session.error_message,
  });

  delete req.session.success_message;
  delete req.session.error_message;
};

export const getBiddingHistory = async (req, res) => {
  const productId = req.query.id;
  
  if (!productId) {
    return res.redirect('/');
  }

  try {
    const product = await productModel.findByProductId2(productId, null);
    
    if (!product) {
      return res.status(404).render('404', { message: 'Product not found' });
    }

    const biddingHistory = await biddingHistoryModel.getBiddingHistory(productId);
    
    res.render('vwProduct/biddingHistory', { 
      product,
      biddingHistory
    });
  } catch (error) {
    console.error('Error loading bidding history:', error);
    res.status(500).render('500', { message: 'Unable to load bidding history' });
  }
};

export const postWatchlist = async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  const isInWatchlist = await watchListModel.isInWatchlist(userId, productId);
  if (!isInWatchlist) {
    await watchListModel.addToWatchlist(userId, productId);
  }

  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
};

export const deleteWatchlist = async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await watchListModel.removeFromWatchlist(userId, productId);

  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
};

export const postBid = async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ''));

  try {
    const result = await biddingService.placeBid(productId, userId, bidAmount);

    const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
    biddingService.sendBidNotificationEmails(result, productUrl);

    req.session.success_message = biddingService.buildBidResultMessage(result);
    res.redirect(`/products/detail?id=${productId}`);

  } catch (error) {
    console.error('Bid error:', error);
    req.session.error_message = error.message || 'An error occurred while placing bid. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
};

export const postComment = async (req, res) => {
  const { productId, content, parentId } = req.body;
  const userId = req.session.authUser.id;

  try {
    const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
    await commentService.createCommentAndNotify({ productId, userId, content, parentId, productUrl });

    req.session.success_message = 'Comment posted successfully!';
    res.redirect(`/products/detail?id=${productId}`);

  } catch (error) {
    console.error('Post comment error:', error);
    req.session.error_message = error.message || 'Failed to post comment. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
};

export const getBidHistory = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingService.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get bid history error:', error);
    res.status(500).json({ success: false, message: 'Unable to load bidding history' });
  }
};

export const getCompleteOrder = async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.query.id;
  
  if (!productId) {
    return res.redirect('/');
  }
  
  const product = await productModel.findByProductId2(productId, userId);
  
  if (!product) {
    return res.status(404).render('404', { message: 'Product not found' });
  }
  
  const productStatus = productService.determineProductStatus(product);
  
  if (productStatus !== 'PENDING') {
    return res.redirect(`/products/detail?id=${productId}`);
  }
  
  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;
  
  if (!isSeller && !isHighestBidder) {
    return res.status(403).render('403', { message: 'You do not have permission to access this page' });
  }
  
  const order = await orderService.getOrCreateOrder(productId, product);
  const { paymentInvoice, shippingInvoice, messages } = await orderService.getOrderDetails(order.id);
  
  res.render('vwProduct/complete-order', {
    product,
    order,
    paymentInvoice,
    shippingInvoice,
    messages,
    isSeller,
    isHighestBidder,
    currentUserId: userId
  });
};

export const postUploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const urls = req.files.map(file => `uploads/${file.filename}`);
    res.json({ success: true, urls });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
};

export const postSubmitPayment = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    await orderService.submitPayment(orderId, userId, req.body);
    
    res.json({ success: true, message: 'Payment submitted successfully' });
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500)
      .json({ error: error.message || 'Failed to submit payment' });
  }
};

export const postConfirmPayment = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    await orderService.confirmPayment(orderId, userId);
    
    res.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    const status = error.message === 'Unauthorized' ? 403 
      : error.message === 'No payment invoice found' ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to confirm payment' });
  }
};

export const postSubmitShipping = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    await orderService.submitShipping(orderId, userId, req.body);
    
    res.json({ success: true, message: 'Shipping info submitted successfully' });
  } catch (error) {
    console.error('Submit shipping error:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500)
      .json({ error: error.message || 'Failed to submit shipping' });
  }
};

export const postConfirmDelivery = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    await orderService.confirmDelivery(orderId, userId);
    
    res.json({ success: true, message: 'Delivery confirmed successfully' });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500)
      .json({ error: error.message || 'Failed to confirm delivery' });
  }
};

export const postSubmitRating = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { rating, comment } = req.body;
    
    await orderService.submitRating(orderId, userId, { rating, comment });
    
    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500)
      .json({ error: error.message || 'Failed to submit rating' });
  }
};

export const postCompleteTransaction = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    await orderService.completeTransaction(orderId, userId);
    
    res.json({ success: true, message: 'Transaction completed' });
  } catch (error) {
    console.error('Complete transaction error:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500)
      .json({ error: error.message || 'Failed to complete transaction' });
  }
};

export const postSendMessage = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { message } = req.body;
    
    await orderService.sendMessage(orderId, userId, message);
    
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500)
      .json({ error: error.message || 'Failed to send message' });
  }
};

export const getOrderMessages = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    const messagesHtml = await orderService.getFormattedMessages(orderId, userId);
    
    res.json({ success: true, messagesHtml });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(error.message === 'Unauthorized' ? 403 : 500)
      .json({ error: error.message || 'Failed to get messages' });
  }
};

export const postRejectBidder = async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    const { rejectedUser, product, seller } = await biddingService.rejectBidder(productId, bidderId, sellerId);

    const homeUrl = `${req.protocol}://${req.get('host')}/`;
    biddingService.sendRejectBidderEmail(rejectedUser, product, seller?.fullname || 'N/A', homeUrl);

    res.json({ success: true, message: 'Bidder rejected successfully' });
  } catch (error) {
    console.error('Error rejecting bidder:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to reject bidder' 
    });
  }
};

export const postUnrejectBidder = async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    const product = await productModel.findByProductId2(productId, sellerId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.seller_id !== sellerId) {
      throw new Error('Only the seller can unreject bidders');
    }

    const now = new Date();
    const endDate = new Date(product.end_at);
    
    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error('Can only unreject bidders for active auctions');
    }

    await rejectedBidderModel.unrejectBidder(productId, bidderId);

    res.json({ success: true, message: 'Bidder can now bid on this product again' });
  } catch (error) {
    console.error('Error unrejecting bidder:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to unreject bidder' 
    });
  }
};

export const postBuyNow = async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.authUser.id;

  try {
    await biddingService.buyNow(productId, userId);

    res.json({ 
      success: true, 
      message: 'Congratulations! You have successfully purchased the product at Buy Now price. Please proceed to payment.',
      redirectUrl: `/products/complete-order?id=${productId}`
    });

  } catch (error) {
    console.error('Buy Now error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to purchase product' 
    });
  }
};

export const getSellerRatings = async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId);
    
    if (!sellerId) {
      return res.redirect('/');
    }
    
    const seller = await userModel.findById(sellerId);
    if (!seller) {
      return res.redirect('/');
    }
    
    const ratingDetails = await ratingService.getRatingDetails(sellerId);
    
    res.render('vwProduct/seller-ratings', {
      sellerName: seller.fullname,
      ...ratingDetails
    });
    
  } catch (error) {
    console.error('Error loading seller ratings page:', error);
    res.redirect('/');
  }
};

export const getBidderRatings = async (req, res) => {
  try {
    const bidderId = parseInt(req.params.bidderId);
    
    if (!bidderId) {
      return res.redirect('/');
    }
    
    const bidder = await userModel.findById(bidderId);
    if (!bidder) {
      return res.redirect('/');
    }
    
    const ratingDetails = await ratingService.getRatingDetails(bidderId);
    
    const maskedName = bidder.fullname ? bidder.fullname.split('').map((char, index) => 
      index % 2 === 0 ? char : '*'
    ).join('') : '';
    
    res.render('vwProduct/bidder-ratings', {
      bidderName: maskedName,
      ...ratingDetails
    });
    
  } catch (error) {
    console.error('Error loading bidder ratings page:', error);
    res.redirect('/');
  }
};
