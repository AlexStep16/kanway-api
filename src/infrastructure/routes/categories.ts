import express from 'express'

const router = express.Router()

router
  .post('/', CategoryValidator.create, CategoryController.createCategory)
  .put('/clone/:categoryId', CategoryController.cloneCategory)
  .put('/:categoryId', CategoryValidator.edit, CategoryController.editCategory)
  .put('/recover/:categoryId', CategoryController.recoverCategory)
  .put('/', CategoryController.editCategories)
  .post('/:categoryId/archive', CategoryController.archiveCategory)
  .delete('/:categoryId', CategoryController.deleteCategory)
  .get('/:boardId', CategoryController.getCategories)
  .get('/:boardId/count', CategoryController.getCategoriesCount)

export default router
