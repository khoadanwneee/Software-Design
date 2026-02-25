import * as productModel from '../models/product.model.js';
import path from 'path';
import fs from 'fs';

/**
 * Build a standardized product data object from the raw form body.
 * @param {object} body - req.body from the product add form
 * @param {number|string} sellerId - the seller's user ID
 * @returns {object} productData ready for insertion
 */
export function buildProductData(body, sellerId) {
    return {
        seller_id: sellerId,
        category_id: body.category_id,
        name: body.name,
        starting_price: body.start_price.replace(/,/g, ''),
        step_price: body.step_price.replace(/,/g, ''),
        buy_now_price: body.buy_now_price !== '' ? body.buy_now_price.replace(/,/g, '') : null,
        created_at: new Date(body.created_at),
        end_at: new Date(body.end_date),
        auto_extend: body.auto_extend === '1',
        thumbnail: null,
        description: body.description,
        highest_bidder_id: null,
        current_price: body.start_price.replace(/,/g, ''),
        is_sold: null,
        closed_at: null,
        allow_unrated_bidder: body.allow_new_bidders === '1',
    };
}

/**
 * Move the uploaded thumbnail to the permanent product images directory
 * and update the product record with the saved path.
 * @param {number} productId
 * @param {string} thumbnailUploadPath - temporary upload filename / path
 */
async function moveAndSaveThumbnail(productId, thumbnailUploadPath) {
    const dirPath = path.join('public', 'images', 'products').replace(/\\/g, '/');
    const destPath = path.join(dirPath, `p${productId}_thumb.jpg`).replace(/\\/g, '/');
    const srcPath = path.join('public', 'uploads', path.basename(thumbnailUploadPath)).replace(/\\/g, '/');
    const savedDbPath = '/' + path.join('images', 'products', `p${productId}_thumb.jpg`).replace(/\\/g, '/');

    fs.renameSync(srcPath, destPath);
    await productModel.updateProductThumbnail(productId, savedDbPath);
}

/**
 * Move uploaded sub-images to the permanent product images directory
 * and insert the image records into the database.
 * @param {number} productId
 * @param {string[]} imgsList - array of temporary upload paths
 */
async function moveAndSaveSubimages(productId, imgsList) {
    const dirPath = path.join('public', 'images', 'products').replace(/\\/g, '/');
    const newImgPaths = [];

    let i = 1;
    for (const imgPath of imgsList) {
        const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, '/');
        const newPath = path.join(dirPath, `p${productId}_${i}.jpg`).replace(/\\/g, '/');
        const savedPath = '/' + path.join('images', 'products', `p${productId}_${i}.jpg`).replace(/\\/g, '/');

        fs.renameSync(oldPath, newPath);
        newImgPaths.push({
            product_id: productId,
            img_link: savedPath,
        });
        i++;
    }

    await productModel.addProductImages(newImgPaths);
}

/**
 * Create a product with its thumbnail and sub-images.
 * Shared between admin and seller product-add flows.
 *
 * @param {object} productData - data object built by buildProductData()
 * @param {string} thumbnailPath - temporary upload path of the thumbnail
 * @param {string[]} imgsList - array of temporary sub-image upload paths
 * @returns {number} the newly created product's ID
 */
export async function createProductWithImages(productData, thumbnailPath, imgsList) {
    const returnedID = await productModel.addProduct(productData);
    const productId = returnedID[0].id;

    await moveAndSaveThumbnail(productId, thumbnailPath);
    await moveAndSaveSubimages(productId, imgsList);

    return productId;
}
