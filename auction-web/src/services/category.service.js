import * as categoryModel from '../models/category.model.js';

async function resolveCategoryIds(categoryId, category) {
  if (!category) return [];

  if (category.parent_id === null) {
    const childCategories =
      await categoryModel.findChildCategoryIds(categoryId);

    const childIds = childCategories.map(cat => cat.id);
    return [categoryId, ...childIds];
  }

  return [categoryId];
}



export async function getCategoryWithResolvedIds(categoryId) {
  const category = await categoryModel.findByCategoryId(categoryId);
  if (!category) return null;

  const categoryIds = await resolveCategoryIds(categoryId, category);

  return {
    category,
    categoryIds
  };
}

// ------------------------------------------------------------------
// additional wrappers for controller/service separation
// ------------------------------------------------------------------

export function findAll() {
  return categoryModel.findAll();
}

export function findByCategoryId(id) {
  return categoryModel.findByCategoryId(id);
}

export function findLevel1Categories() {
  return categoryModel.findLevel1Categories();
}

export function createCategory(data) {
  return categoryModel.createCategory(data);
}

export function updateCategory(id, data) {
  return categoryModel.updateCategory(id, data);
}

export function isCategoryHasProducts(id) {
  return categoryModel.isCategoryHasProducts(id);
}

export function deleteCategory(id) {
  return categoryModel.deleteCategory(id);
}



