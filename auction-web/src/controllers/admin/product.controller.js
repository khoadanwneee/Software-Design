import * as productModel from '../../models/product.model.js';
import * as userModel from '../../models/user.model.js';
import path from 'path';
import fs from 'fs';

export const getList = async (req, res) => {
    const products = await productModel.findAll();
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;
    delete req.session.success_message;
    delete req.session.error_message;
    const filteredProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        seller_name: p.seller_name,
        current_price: p.current_price,
        highest_bidder_name: p.highest_bidder_name
    }));
    res.render('vwAdmin/product/list', {
        products : filteredProducts,
        empty: products.length === 0,
        success_message,
        error_message
    });
};

export const getAdd = async (req, res) => {
    try {
        const sellers = await userModel.findUsersByRole('seller');
        res.render('vwAdmin/product/add', { sellers });
    } catch (error) {
        console.error('Error loading sellers:', error);
        res.render('vwAdmin/product/add', { 
            sellers: [],
            error_message: 'Failed to load sellers list'
        });
    }
};

export const postAdd = async (req, res) => {
    const product = req.body;
    const productData = {
        seller_id: product.seller_id,
        category_id: product.category_id,
        name: product.name,
        starting_price: product.start_price.replace(/,/g, ''),
        step_price: product.step_price.replace(/,/g, ''),
        buy_now_price: product.buy_now_price !== '' ? product.buy_now_price.replace(/,/g, '') : null,
        created_at: product.created_at,
        end_at: product.end_date,
        auto_extend: product.auto_extend === '1' ? true : false,
        thumbnail: null,
        description: product.description,
        highest_bidder_id: null,
        current_price: product.start_price.replace(/,/g, ''),
        is_sold: null,
        closed_at: null,
        allow_unrated_bidder: product.allow_new_bidders === '1' ? true : false
    };
    const returnedID = await productModel.addProduct(productData);

    const dirPath = path.join('public', 'images', 'products').replace(/\\/g, "/");
    const imgs = JSON.parse(product.imgs_list);

    const mainPath = path.join(dirPath, `p${returnedID[0].id}_thumb.jpg`).replace(/\\/g, "/");
    const oldMainPath = path.join('public', 'uploads', path.basename(product.thumbnail)).replace(/\\/g, "/");
    const savedMainPath = '/' + path.join('images', 'products', `p${returnedID[0].id}_thumb.jpg`).replace(/\\/g, "/");
    fs.renameSync(oldMainPath, mainPath);
    await productModel.updateProductThumbnail(returnedID[0].id, savedMainPath);

    let i = 1;
    let newImgPaths = [];
    for (const imgPath of imgs) {
        const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, "/");
        const newPath = path.join(dirPath, `p${returnedID[0].id}_${i}.jpg`).replace(/\\/g, "/");
        const savedPath = '/' + path.join('images', 'products', `p${returnedID[0].id}_${i}.jpg`).replace(/\\/g, "/");
        fs.renameSync(oldPath, newPath);
        newImgPaths.push({
            product_id: returnedID[0].id,
            img_link: savedPath
        });
        i++;
    }
    await productModel.addProductImages(newImgPaths);
    res.redirect('/admin/products/list');
};

export const getDetail = async (req, res) => {
    const id = req.params.id;
    const product = await productModel.findByProductIdForAdmin(id);
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;
    delete req.session.success_message;
    delete req.session.error_message;
    res.render('vwAdmin/product/detail', { product } );
};

export const getEdit = async (req, res) => {
    const id = req.params.id;
    const product = await productModel.findByProductIdForAdmin(id);
    const sellers = await userModel.findUsersByRole('seller');
    res.render('vwAdmin/product/edit', { product, sellers } );
};

export const postEdit = async (req, res) => {
    const newProduct = req.body;
    await productModel.updateProduct(newProduct.id, newProduct);
    req.session.success_message = 'Product updated successfully!';
    res.redirect('/admin/products/list');
};

export const postDelete = async (req, res) => {
    const { id } = req.body;
    await productModel.deleteProduct(id);
    req.session.success_message = 'Product deleted successfully!';
    res.redirect('/admin/products/list');
};

export const postUploadThumbnail = async (req, res) => {
    res.json({
        success: true,
        file: req.file
    });
};

export const postUploadSubimages = async (req, res) => {
    res.json({
        success: true,
        files: req.files
    });
};
