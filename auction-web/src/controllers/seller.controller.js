import * as productModel from '../models/product.model.js';
import * as reviewModel from '../models/review.model.js';
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import { sendMail } from '../utils/mailer.js';
import { buildProductData, createProductWithImages } from '../services/product.service.js';

export const getDashboard = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const stats = await productModel.getSellerStats(sellerId);
    res.render('vwSeller/dashboard', { stats });
};

export const getAllProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const products = await productModel.findAllProductsBySellerId(sellerId);
    res.render('vwSeller/all-products', { products });
};

export const getActiveProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const products = await productModel.findActiveProductsBySellerId(sellerId);
    res.render('vwSeller/active', { products });
};

export const getPendingProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const [products, stats] = await Promise.all([
        productModel.findPendingProductsBySellerId(sellerId),
        productModel.getPendingProductsStats(sellerId)
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
        productModel.findSoldProductsBySellerId(sellerId),
        productModel.getSoldProductsStats(sellerId)
    ]);
    
    const productsWithReview = await Promise.all(products.map(async (product) => {
        const review = await reviewModel.getProductReview(sellerId, product.highest_bidder_id, product.id);
        
        const hasActualReview = review && review.rating !== 0;
        
        return {
            ...product,
            hasReview: hasActualReview,
            reviewRating: hasActualReview ? (review.rating === 1 ? 'positive' : 'negative') : null,
            reviewComment: hasActualReview ? review.comment : ''
        };
    }));
    
    res.render('vwSeller/sold-products', { products: productsWithReview, stats });
};

export const getExpiredProducts = async (req, res) => {
    const sellerId = req.session.authUser.id;
    const products = await productModel.findExpiredProductsBySellerId(sellerId);
    
    for (let product of products) {
        if (product.status === 'Cancelled' && product.highest_bidder_id) {
            const review = await reviewModel.getProductReview(sellerId, product.highest_bidder_id, product.id);
            const hasActualReview = review && review.rating !== 0;
            
            product.hasReview = hasActualReview;
            if (hasActualReview) {
                product.reviewRating = review.rating === 1 ? 'positive' : 'negative';
                product.reviewComment = review.comment;
            }
        }
    }
    
    res.render('vwSeller/expired', { products });
};

export const getAddProduct = async (req, res) => {
    const success_message = req.session.success_message;
    delete req.session.success_message;
    res.render('vwSeller/add', { success_message });
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
        
        const product = await productModel.cancelProduct(productId, sellerId);
        
        if (highest_bidder_id) {
            const reviewModule = await import('../models/review.model.js');
            const reviewData = {
                reviewer_id: sellerId,
                reviewee_id: highest_bidder_id,
                product_id: productId,
                rating: -1,
                comment: reason || 'Auction cancelled by seller'
            };
            await reviewModule.createReview(reviewData);
        }
        
        res.json({ success: true, message: 'Auction cancelled successfully' });
    } catch (error) {
        console.error('Cancel product error:', error);
        
        if (error.message === 'Product not found') {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const postRateBidder = async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        
        if (!highest_bidder_id) {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        const ratingValue = rating === 'positive' ? 1 : -1;
        
        const existingReview = await reviewModel.findByReviewerAndProduct(sellerId, productId);
        
        if (existingReview) {
            await reviewModel.updateByReviewerAndProduct(sellerId, productId, {
                rating: ratingValue,
                comment: comment || null
            });
        } else {
            const reviewData = {
                reviewer_id: sellerId,
                reviewee_id: highest_bidder_id,
                product_id: productId,
                rating: ratingValue,
                comment: comment || ''
            };
            await reviewModel.createReview(reviewData);
        }
        
        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('Rate bidder error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const putRateBidder = async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        
        if (!highest_bidder_id) {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        const ratingValue = rating === 'positive' ? 1 : -1;
        
        await reviewModel.updateReview(sellerId, highest_bidder_id, productId, {
            rating: ratingValue,
            comment: comment || ''
        });
        
        res.json({ success: true, message: 'Rating updated successfully' });
    } catch (error) {
        console.error('Update rating error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const postAppendDescription = async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { description } = req.body;
        
        if (!description || description.trim() === '') {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }
        
        const product = await productModel.findByProductId2(productId, null);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        if (product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        await productDescUpdateModel.addUpdate(productId, description.trim());
        
        const [bidders, commenters] = await Promise.all([
            biddingHistoryModel.getUniqueBidders(productId),
            productCommentModel.getUniqueCommenters(productId)
        ]);
        
        const notifyMap = new Map();
        [...bidders, ...commenters].forEach(user => {
            if (user.id !== sellerId && !notifyMap.has(user.email)) {
                notifyMap.set(user.email, user);
            }
        });
        
        const notifyUsers = Array.from(notifyMap.values());
        if (notifyUsers.length > 0) {
            const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
            
            Promise.all(notifyUsers.map(user => {
                return sendMail({
                    to: user.email,
                    subject: `[Auction Update] New description added for "${product.name}"`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9bb8 100%); padding: 20px; text-align: center;">
                                <h1 style="color: white; margin: 0;">Product Description Updated</h1>
                            </div>
                            <div style="padding: 20px; background: #f9f9f9;">
                                <p>Hello <strong>${user.fullname}</strong>,</p>
                                <p>The seller has added new information to the product description:</p>
                                <div style="background: white; padding: 15px; border-left: 4px solid #72AEC8; margin: 15px 0;">
                                    <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
                                    <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${new Intl.NumberFormat('en-US').format(product.current_price)} VND</strong></p>
                                </div>
                                <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;"><i>✉</i> New Description Added:</p>
                                    <div style="color: #333;">${description.trim()}</div>
                                </div>
                                <p>View the product to see the full updated description:</p>
                                <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0;">View Product</a>
                                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                                <p style="color: #999; font-size: 12px;">You received this email because you placed a bid or asked a question on this product.</p>
                            </div>
                        </div>
                    `
                }).catch(err => console.error('Failed to send email to', user.email, err));
            })).catch(err => console.error('Email notification error:', err));
        }
        
        res.json({ success: true, message: 'Description appended successfully' });
    } catch (error) {
        console.error('Append description error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getDescriptionUpdates = async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        
        const product = await productModel.findByProductId2(productId, null);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        if (product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        const updates = await productDescUpdateModel.findByProductId(productId);
        
        res.json({ success: true, updates });
    } catch (error) {
        console.error('Get description updates error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
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
        
        const update = await productDescUpdateModel.findById(updateId);
        if (!update) {
            return res.status(404).json({ success: false, message: 'Update not found' });
        }
        
        const product = await productModel.findByProductId2(update.product_id, null);
        if (!product || product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        await productDescUpdateModel.updateContent(updateId, content.trim());
        
        res.json({ success: true, message: 'Update saved successfully' });
    } catch (error) {
        console.error('Update description error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const deleteDescriptionUpdate = async (req, res) => {
    try {
        const updateId = req.params.updateId;
        const sellerId = req.session.authUser.id;
        
        const update = await productDescUpdateModel.findById(updateId);
        if (!update) {
            return res.status(404).json({ success: false, message: 'Update not found' });
        }
        
        const product = await productModel.findByProductId2(update.product_id, null);
        if (!product || product.seller_id !== sellerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        await productDescUpdateModel.deleteUpdate(updateId);
        
        res.json({ success: true, message: 'Update deleted successfully' });
    } catch (error) {
        console.error('Delete description error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
