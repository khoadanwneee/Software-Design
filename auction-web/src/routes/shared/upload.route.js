import express from 'express';
import multer from 'multer';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

export const upload = multer({ storage });

export function createUploadRoutes() {
    const router = express.Router();

    router.post('/upload-thumbnail', upload.single('thumbnail'), (req, res) => {
        res.json({ success: true, file: req.file });
    });

    router.post('/upload-subimages', upload.array('images', 10), (req, res) => {
        res.json({ success: true, files: req.files });
    });

    return router;
}
