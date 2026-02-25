import express from 'express';
import * as sellerController from '../controllers/seller.controller.js';
import { createUploadRoutes } from './shared/upload.route.js';

const router = express.Router();

router.get('/', sellerController.getDashboard);
router.get('/products', sellerController.getAllProducts);
router.get('/products/active', sellerController.getActiveProducts);
router.get('/products/pending', sellerController.getPendingProducts);
router.get('/products/sold', sellerController.getSoldProducts);
router.get('/products/expired', sellerController.getExpiredProducts);
router.get('/products/add', sellerController.getAddProduct);
router.post('/products/add', sellerController.postAddProduct);
router.use('/products', createUploadRoutes());
router.post('/products/:id/cancel', sellerController.postCancelProduct);
router.post('/products/:id/rate', sellerController.postRateBidder);
router.put('/products/:id/rate', sellerController.putRateBidder);
router.post('/products/:id/append-description', sellerController.postAppendDescription);
router.get('/products/:id/description-updates', sellerController.getDescriptionUpdates);
router.put('/products/description-updates/:updateId', sellerController.putDescriptionUpdate);
router.delete('/products/description-updates/:updateId', sellerController.deleteDescriptionUpdate);

export default router;
