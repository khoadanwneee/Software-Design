import express from 'express';
import * as productController from '../../controllers/admin/product.controller.js';
import { createUploadRoutes } from '../shared/upload.route.js';

const router = express.Router();

router.get('/list', productController.getList);
router.get('/add', productController.getAdd);
router.post('/add', productController.postAdd);
router.get('/detail/:id', productController.getDetail);
router.get('/edit/:id', productController.getEdit);
router.post('/edit', productController.postEdit);
router.post('/delete', productController.postDelete);
router.use('/', createUploadRoutes());

export default router;
