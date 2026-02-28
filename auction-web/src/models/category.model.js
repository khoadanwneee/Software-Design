import db from '../utils/db.js';

// DRY fix: Shared base query for category with product count
function baseCategoryQuery() {
    return db('categories as c')
        .leftJoin('categories as parent', 'c.parent_id', 'parent.id')
        .leftJoin('products as p', 'c.id', 'p.category_id')
        .select(
            'c.id',
            'c.name',
            'c.parent_id',
            'parent.name as parent_name'
        )
        .count('p.id as product_count')
        .groupBy('c.id', 'c.name', 'c.parent_id', 'parent.name');
}

export async function findByCategoryId(id){
    const category = await baseCategoryQuery()
        .where('c.id', id)
        .first();
    
    if (!category) return null;
    
    // Nếu category có con (level 1), cộng thêm product_count của các category con
    const childrenCount = await db('categories as child')
        .leftJoin('products as p', 'child.id', 'p.category_id')
        .where('child.parent_id', id)
        .count('p.id as total')
        .first();
    
    // Tổng = product_count của chính nó + product_count của con
    category.product_count = parseInt(category.product_count) + parseInt(childrenCount?.total || 0);
    
    return category;
}
export function findAll() {
    return baseCategoryQuery()
        .orderBy('c.parent_id', 'asc')
        .orderBy('c.id', 'asc');
}

export function findLevel1Categories() {
    return db('categories').
        where('parent_id', null);
}

export function findLevel2Categories() {
    return db('categories').
        whereNot('parent_id', null);
}
export function createCategory(category) {
    return db('categories').insert(category).returning('*');
}

export function updateCategory(id, category) {
    return db('categories')
        .where('id', id)
        .update(category)
        .returning('*');
}

export function deleteCategory(id) {
    return db('categories').where('id', id).del();
} 
export function isCategoryHasProducts(id) {
    return db('products').where('category_id', id).first();
}

export function findChildCategoryIds(parentCategoryId) {
    return db('categories')
        .where('parent_id', parentCategoryId)
        .select('id');
}