import express from 'express';
import * as systemController from '../../controllers/admin/system.controller.js';

const router = express.Router();

router.get('/settings', systemController.getSettings);
router.post('/settings', systemController.postSettings);

export default router;
