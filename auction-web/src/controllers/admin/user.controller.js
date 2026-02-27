import bcrypt from 'bcryptjs';
import * as upgradeRequestService from '../../services/upgradeRequest.service.js';
import * as userService from '../../services/user.service.js';
import { sendMail } from '../../utils/mailer.js';
import { emailSimpleLayout } from '../../utils/emailTemplates.js';

export const getList = async (req, res) => {
    const users = await userService.loadAllUsers();
    
    res.render('vwAdmin/users/list', { 
        users,
        empty: users.length === 0
    });
};

export const getDetail = async (req, res) => {
    const id = req.params.id;
    const user = await userModel.findById(id);
    res.render('vwAdmin/users/detail', { user });
};

export const getAdd = async (req, res) => {
    res.render('vwAdmin/users/add');
};

export const postAdd = async (req, res) => {
    try {
        const { fullname, email, address, date_of_birth, role, email_verified, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            fullname,
            email,
            address,
            date_of_birth: date_of_birth || null,
            role,
            email_verified: email_verified === 'true',
            password_hash: hashedPassword,
            created_at: new Date(),
            updated_at: new Date()
        };
        
        await userService.add(newUser);
        req.session.success_message = 'User added successfully!';
        res.redirect('/admin/users/list');
    } catch (error) {
        console.error('Add user error:', error);
        req.session.error_message = 'Failed to add user. Please try again.';
        res.redirect('/admin/users/add');
    }
};

export const getEdit = async (req, res) => {
    const id = req.params.id;
    const user = await userModel.findById(id);
    res.render('vwAdmin/users/edit', { user });
};

export const postEdit = async (req, res) => {
    try {
        const { id, fullname, email, address, date_of_birth, role, email_verified } = req.body;
        
        const updateData = {
            fullname,
            email,
            address,
            date_of_birth: date_of_birth || null,
            role,
            email_verified: email_verified === 'true',
            updated_at: new Date()
        };
        
        await userService.update(id, updateData);
        req.session.success_message = 'User updated successfully!';
        res.redirect('/admin/users/list');
    } catch (error) {
        console.error('Update user error:', error);
        req.session.error_message = 'Failed to update user. Please try again.';
        res.redirect(`/admin/users/edit/${req.body.id}`);
    }
};

export const postResetPassword = async (req, res) => {
    try {
        const { id } = req.body;
        const defaultPassword = '123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        const user = await userService.findById(id);
        
        await userService.update(id, { 
            password_hash: hashedPassword,
            updated_at: new Date()
        });
        
        if (user && user.email) {
            try {
                const resetBody = `
                            <p>Dear <strong>${user.fullname}</strong>,</p>
                            <p>Your account password has been reset by an administrator.</p>
                            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 0;"><strong>Your new temporary password:</strong></p>
                                <p style="font-size: 24px; color: #e74c3c; margin: 10px 0; font-weight: bold;">${defaultPassword}</p>
                            </div>
                            <p style="color: #e74c3c;"><strong>Important:</strong> Please log in and change your password immediately for security purposes.</p>
                            <p>If you did not request this password reset, please contact our support team immediately.</p>`;
                await sendMail({
                    to: user.email,
                    subject: 'Your Password Has Been Reset - Online Auction',
                    html: emailSimpleLayout('Password Reset Notification', resetBody, '#333')
                });
                console.log(`Password reset email sent to ${user.email}`);
            } catch (emailError) {
                console.error('Failed to send password reset email:', emailError);
            }
        }
        
        req.session.success_message = `Password of ${user.fullname} reset successfully to default: 123`;
        res.redirect(`/admin/users/list`);
    } catch (error) {
        console.error('Reset password error:', error);
        req.session.error_message = 'Failed to reset password. Please try again.';
        res.redirect(`/admin/users/list`);
    }
};

export const postDelete = async (req, res) => {
    try {
        const { id } = req.body;
        await userService.deleteUser(id);
        req.session.success_message = 'User deleted successfully!';
        res.redirect('/admin/users/list');
    } catch (error) {
        console.error('Delete user error:', error);
        req.session.error_message = 'Failed to delete user. Please try again.';
        res.redirect('/admin/users/list');
    }
};

export const getUpgradeRequests = async (req, res) => {
    const requests = await upgradeRequestService.loadAllUpgradeRequests();
    res.render('vwAdmin/users/upgradeRequests', { requests });
};

export const postApproveUpgrade = async (req, res) => {
    const id = req.body.id;
    const bidderId = req.body.bidder_id;
    await upgradeRequestService.approveUpgradeRequest(id);
    await userService.updateUserRoleToSeller(bidderId);
    res.redirect('/admin/users/upgrade-requests');
};

export const postRejectUpgrade = async (req, res) => {
    const id = req.body.id;
    const admin_note = req.body.admin_note;
    await upgradeRequestService.rejectUpgradeRequest(id, admin_note);
    res.redirect('/admin/users/upgrade-requests');
};
