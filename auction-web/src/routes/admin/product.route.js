import express from 'express';
import multer from 'multer';
import * as productController from '../../controllers/admin/product.controller.js';

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

router.get('/list', productController.getList);
router.get('/add', productController.getAdd);
router.post('/add', productController.postAdd);
router.get('/detail/:id', productController.getDetail);
router.get('/edit/:id', productController.getEdit);
router.post('/edit', productController.postEdit);
router.post('/delete', productController.postDelete);
router.post('/upload-thumbnail', upload.single('thumbnail'), productController.postUploadThumbnail);
router.post('/upload-subimages', upload.array('images', 10), productController.postUploadSubimages);

export default router;
