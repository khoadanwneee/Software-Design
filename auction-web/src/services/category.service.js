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




