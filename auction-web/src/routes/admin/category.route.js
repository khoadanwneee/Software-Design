import express from 'express';
import * as categoryController from '../../controllers/admin/category.controller.js';

const router = express.Router();

router.get('/list', categoryController.getList);
router.get('/detail/:id', categoryController.getDetail);
router.get('/add', categoryController.getAdd);
router.get('/edit/:id', categoryController.getEdit);
router.post('/add', categoryController.postAdd);
router.post('/edit', categoryController.postEdit);
router.post('/delete', categoryController.postDelete);

export default router;
