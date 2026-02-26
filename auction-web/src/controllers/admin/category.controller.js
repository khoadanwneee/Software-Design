import * as categoryModel from '../../models/category.model.js';

export const getList = async (req, res) => {
    const categories = await categoryModel.findAll();
    
    res.render('vwAdmin/category/list', { 
        categories,
        empty: categories.length === 0
    });
};

export const getDetail = async (req, res) => {
    const id = req.params.id;
    const category = await categoryModel.findByCategoryId(id);
    res.render('vwAdmin/category/detail', { category } );
};

export const getAdd = async (req, res) => {
    const parentCategories = await categoryModel.findLevel1Categories();
    res.render('vwAdmin/category/add', { parentCategories });
};

export const getEdit = async (req, res) => {
    const id = req.params.id;
    const category = await categoryModel.findByCategoryId(id);
    const parentCategories = await categoryModel.findLevel1Categories();
    res.render('vwAdmin/category/edit', { category, parentCategories });
};

export const postAdd = async (req, res) => {
    const { name, parent_id } = req.body;
    await categoryModel.createCategory({ name, parent_id: parent_id || null });
    req.session.success_message = 'Category added successfully!';
    res.redirect('/admin/categories/list');
};

export const postEdit = async (req, res) => {
    const { id, name, parent_id } = req.body;
    await categoryModel.updateCategory(id, { name, parent_id: parent_id || null });
    req.session.success_message = 'Category updated successfully!';
    res.redirect('/admin/categories/list');
};

export const postDelete = async (req, res) => {
    const { id } = req.body;
    const hasProducts = await categoryModel.isCategoryHasProducts(id);
    if (hasProducts) {
        req.session.error_message = 'Cannot delete category that has associated products.';
        return res.redirect('/admin/categories/list');
    }
    await categoryModel.deleteCategory(id);
    req.session.success_message = 'Category deleted successfully!';
    res.redirect('/admin/categories/list');
};
