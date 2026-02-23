import express from 'express';
import * as adminAccountController from '../../controllers/admin/account.controller.js';

const router = express.Router();

router.get('/profile', adminAccountController.getProfile);

export default router;
