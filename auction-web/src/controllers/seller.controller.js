import { buildProductData, createProductWithImages } from '../services/product.service.js';
import * as productService from '../services/product.service.js';
import * as ratingService from '../services/rating.service.js';
import * as productDescriptionService from '../services/productDescription.service.js';
import * as userService from '../services/user.service.js';
import { buildProductUrl } from '../utils/url.js';

// DRY-21: Shared review info attachment logic
async function attachReviewInfo(product, sellerId) {
    const review = await ratingService.getProductReview(sellerId, product.highest_bidder_id, product.id);
    const hasActualReview = review && review.rating !== 0;
    return {
        ...product,
        hasReview: hasActualReview,
        reviewRating: hasActualReview ? (review.rating === 1 ? 'positive' : 'negative') : null,
        reviewComment: hasActualReview ? review.comment : ''
    };
}

// DRY-NEW-9: Shared seller ownership check
async function validateSellerOwnership(productOrUpdateId, sellerId, { isUpdate = false } = {}) {
    if (isUpdate) {
        const update = await productDescriptionService.getUpdateById(productOrUpdateId);
        if (!update) throw Object.assign(new Error('Update not found'), { status: 404 });
        const product = await productService.getProduct(update.product_id, null);
        if (!product || product.seller_id !== sellerId) throw Object.assign(new Error('Unauthorized'), { status: 403 });
        return { update, product };
    }
    const product = await productService.getProduct(productOrUpdateId, null);
    if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
    if (product.seller_id !== sellerId) throw Object.assign(new Error('Unauthorized'), { status: 403 });
    return { product };
}

// DRY-NEW-12: Shared error-to-status mapping for JSON responses
const ERROR_STATUS_MAP = {
    'Product not found': 404,
    'Update not found': 404,
    'Unauthorized': 403,
    'Description is required': 400,
};

function getErrorStatus(error) {
    return error.status || ERROR_STATUS_MAP[error.message] || 500;
}

export const getDashboard = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const stats = await productService.getSellerStats(sellerId);
    res.render('vwSeller/dashboard', { stats });
};

export const getAllProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const products = await productService.getAllProductsBySellerId(sellerId);
    res.render('vwSeller/all-products', { products });
};

export const getActiveProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const products = await productService.getActiveProductsBySellerId(sellerId);
    res.render('vwSeller/active', { products });
};

export const getPendingProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const [products, stats] = await Promise.all([
        productService.getPendingProductsBySellerId(sellerId),
        productService.getPendingProductsStats(sellerId)
    ]);
    
    let success_message = '';
    if (req.query.message === 'cancelled') {
        success_message = 'Auction cancelled successfully!';
    }
    
    res.render('vwSeller/pending', { products, stats, success_message });
};

export const getSoldProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const [products, stats] = await Promise.all([
        productService.getSoldProductsBySellerId(sellerId),
        productService.getSoldProductsStats(sellerId)
    ]);
    
    const productsWithReview = await Promise.all(
        products.map(product => attachReviewInfo(product, sellerId))
    );
    
    res.render('vwSeller/sold-products', { products: productsWithReview, stats });
};

export const getExpiredProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const products = await productService.getExpiredProductsBySellerId(sellerId);
    
    for (let i = 0; i < products.length; i++) {
        if (products[i].status === 'Cancelled' && products[i].highest_bidder_id) {
            products[i] = await attachReviewInfo(products[i], sellerId);
        }
    }
    
    res.render('vwSeller/expired', { products });
};

export const getAddProduct = async (req, res) => {
    res.render('vwSeller/add');
};

export const postAddProduct = async (req, res) => {
    const product = req.body;
    const sellerId = req.session.authUser.id;
    const productData = buildProductData(product, sellerId);
    const imgs = JSON.parse(product.imgs_list);

    await createProductWithImages(productData, product.thumbnail, imgs);

    req.session.success_message = 'Product added successfully!';
    res.redirect('/seller/products/add');
};

export const postCancelProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { reason, highest_bidder_id } = req.body;
        
        await productService.cancelProduct(productId, sellerId);
        
        if (highest_bidder_id) {
            await ratingService.createOrUpdateReview(
                sellerId, highest_bidder_id, productId,
                'negative', reason || 'Auction cancelled by seller'
            );
        }
        
        res.json({ success: true, message: 'Auction cancelled successfully' });
    } catch (error) {
        console.error('Cancel product error:', error);
        const status = getErrorStatus(error);
        res.status(status).json({ success: false, message: error.message || 'Server error' });
    }
};

/**
 * Shared handler cho POST/PUT rate bidder — chỉ khác success message
 */
async function handleBidderRating(req, res, successMessage) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        
        if (!highest_bidder_id) {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        await ratingService.createOrUpdateReview(sellerId, highest_bidder_id, productId, rating, comment);
        
        res.json({ success: true, message: successMessage });
    } catch (error) {
        console.error('Rate bidder error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const postRateBidder = (req, res) => handleBidderRating(req, res, 'Rating submitted successfully');

export const putRateBidder = (req, res) => handleBidderRating(req, res, 'Rating updated successfully');

export const postAppendDescription = async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { description } = req.body;
        const productUrl = buildProductUrl(req, productId);

        await productDescriptionService.appendDescriptionAndNotify({ productId, sellerId, description, productUrl });

        res.json({ success: true, message: 'Description appended successfully' });
    } catch (error) {
        console.error('Append description error:', error);
        const status = getErrorStatus(error);
        res.status(status).json({ success: false, message: error.message || 'Server error' });
    }
};

export const getDescriptionUpdates = async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        
        await validateSellerOwnership(productId, sellerId);
        const updates = await productDescriptionService.getDescriptionUpdates(productId);
        
        res.json({ success: true, updates });
    } catch (error) {
        console.error('Get description updates error:', error);
        const status = getErrorStatus(error);
        res.status(status).json({ success: false, message: error.message || 'Server error' });
    }
};

export const putDescriptionUpdate = async (req, res) => {
    try {
        const updateId = req.params.updateId;
        const sellerId = req.session.authUser.id;
        const { content } = req.body;
        
        if (!content || content.trim() === '') {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }
        
        await validateSellerOwnership(updateId, sellerId, { isUpdate: true });
        await productDescriptionService.updateContent(updateId, content.trim());
        
        res.json({ success: true, message: 'Update saved successfully' });
    } catch (error) {
        console.error('Update description error:', error);
        const status = getErrorStatus(error);
        res.status(status).json({ success: false, message: error.message || 'Server error' });
    }
};

export const deleteDescriptionUpdate = async (req, res) => {
    try {
        const updateId = req.params.updateId;
        const sellerId = req.session.authUser.id;
        
        await validateSellerOwnership(updateId, sellerId, { isUpdate: true });
        await productDescriptionService.deleteUpdate(updateId);
        
        res.json({ success: true, message: 'Update deleted successfully' });
    } catch (error) {
        console.error('Delete description error:', error);
        const status = getErrorStatus(error);
        res.status(status).json({ success: false, message: error.message || 'Server error' });
    }
};
