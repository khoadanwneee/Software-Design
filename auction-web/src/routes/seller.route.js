import express from 'express';
import multer from 'multer';
import * as sellerController from '../controllers/seller.controller.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

router.get('/', sellerController.getDashboard);
router.get('/products', sellerController.getAllProducts);
router.get('/products/active', sellerController.getActiveProducts);
router.get('/products/pending', sellerController.getPendingProducts);
router.get('/products/sold', sellerController.getSoldProducts);
router.get('/products/expired', sellerController.getExpiredProducts);
router.get('/products/add', sellerController.getAddProduct);
router.post('/products/add', sellerController.postAddProduct);
router.post('/products/upload-thumbnail', upload.single('thumbnail'), sellerController.postUploadThumbnail);
router.post('/products/upload-subimages', upload.array('images', 10), sellerController.postUploadSubimages);
router.post('/products/:id/cancel', sellerController.postCancelProduct);
router.post('/products/:id/rate', sellerController.postRateBidder);
router.put('/products/:id/rate', sellerController.putRateBidder);
router.post('/products/:id/append-description', sellerController.postAppendDescription);
router.get('/products/:id/description-updates', sellerController.getDescriptionUpdates);
router.put('/products/description-updates/:updateId', sellerController.putDescriptionUpdate);
router.delete('/products/description-updates/:updateId', sellerController.deleteDescriptionUpdate);

export default router;
