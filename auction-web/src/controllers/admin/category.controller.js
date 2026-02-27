import * as categoryService from '../../services/category.service.js';

export const getList = async (req, res) => {
    const categories = await categoryService.findAll();
    
    res.render('vwAdmin/category/list', { 
        categories,
        empty: categories.length === 0
    });
};

export const getDetail = async (req, res) => {
    const id = req.params.id;
    const category = await categoryService.findByCategoryId(id);
    res.render('vwAdmin/category/detail', { category } );
};

export const getAdd = async (req, res) => {
    const parentCategories = await categoryService.findLevel1Categories();
    res.render('vwAdmin/category/add', { parentCategories });
};

export const getEdit = async (req, res) => {
    const id = req.params.id;
    const category = await categoryService.findByCategoryId(id);
    const parentCategories = await categoryService.findLevel1Categories();
    res.render('vwAdmin/category/edit', { category, parentCategories });
};

export const postAdd = async (req, res) => {
    const { name, parent_id } = req.body;
    await categoryService.createCategory({ name, parent_id: parent_id || null });
    req.session.success_message = 'Category added successfully!';
    res.redirect('/admin/categories/list');
};

export const postEdit = async (req, res) => {
    const { id, name, parent_id } = req.body;
    await categoryService.updateCategory(id, { name, parent_id: parent_id || null });
    req.session.success_message = 'Category updated successfully!';
    res.redirect('/admin/categories/list');
};

export const postDelete = async (req, res) => {
    const { id } = req.body;
    const hasProducts = await categoryService.isCategoryHasProducts(id);
    if (hasProducts) {
        req.session.error_message = 'Cannot delete category that has associated products.';
        return res.redirect('/admin/categories/list');
    }
    await categoryService.deleteCategory(id);
    req.session.success_message = 'Category deleted successfully!';
    res.redirect('/admin/categories/list');
};
