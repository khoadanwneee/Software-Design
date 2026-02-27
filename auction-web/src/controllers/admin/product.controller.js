import * as productService from '../../services/product.service.js';
import * as userService from '../../services/user.service.js';
import { buildProductData, createProductWithImages } from '../../services/product.service.js';

export const getList = async (req, res) => {
    const products = await productService.findAll();
    const filteredProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        seller_name: p.seller_name,
        current_price: p.current_price,
        highest_bidder_name: p.highest_bidder_name
    }));
    res.render('vwAdmin/product/list', {
        products : filteredProducts,
        empty: products.length === 0
    });
};

export const getAdd = async (req, res) => {
    try {
        const sellers = await userService.findUsersByRole('seller');
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
    const productData = buildProductData(product, product.seller_id);
    const imgs = JSON.parse(product.imgs_list);

    await createProductWithImages(productData, product.thumbnail, imgs);
    res.redirect('/admin/products/list');
};

export const getDetail = async (req, res) => {
    const id = req.params.id;
    const product = await productService.findByProductIdForAdmin(id);
    res.render('vwAdmin/product/detail', { product } );
};

export const getEdit = async (req, res) => {
    const id = req.params.id;
    const product = await productService.findByProductIdForAdmin(id);
    const sellers = await userService.findUsersByRole('seller');
    res.render('vwAdmin/product/edit', { product, sellers } );
};

export const postEdit = async (req, res) => {
    const newProduct = req.body;
    await productService.updateProduct(newProduct.id, newProduct);
    req.session.success_message = 'Product updated successfully!';
    res.redirect('/admin/products/list');
};

export const postDelete = async (req, res) => {
    const { id } = req.body;
    await productService.deleteProduct(id);
    req.session.success_message = 'Product deleted successfully!';
    res.redirect('/admin/products/list');
};
