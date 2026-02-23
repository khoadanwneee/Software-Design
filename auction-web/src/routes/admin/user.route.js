import express from 'express';
import * as userController from '../../controllers/admin/user.controller.js';

const router = express.Router();

router.get('/list', userController.getList);
router.get('/detail/:id', userController.getDetail);
router.get('/add', userController.getAdd);
router.post('/add', userController.postAdd);
router.get('/edit/:id', userController.getEdit);
router.post('/edit', userController.postEdit);
router.post('/reset-password', userController.postResetPassword);
router.post('/delete', userController.postDelete);
router.get('/upgrade-requests', userController.getUpgradeRequests);
router.post('/upgrade/approve', userController.postApproveUpgrade);
router.post('/upgrade/reject', userController.postRejectUpgrade);

export default router;
