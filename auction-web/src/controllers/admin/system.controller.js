import * as systemSettingService from '../../services/systemSetting.service.js';

const DEFAULT_SETTINGS = {
    new_product_limit_minutes: 60,
    auto_extend_trigger_minutes: 5,
    auto_extend_duration_minutes: 10
};

async function getSettingsWithDefaults() {
    const settings = { ...DEFAULT_SETTINGS };
    const settingsArray = await systemSettingService.getAllSettings();
    if (settingsArray && settingsArray.length > 0) {
        settingsArray.forEach(s => {
            settings[s.key] = parseInt(s.value);
        });
    }
    return settings;
}

export const getSettings = async (req, res) => {
    try {
        const settings = await getSettingsWithDefaults();
        res.render('vwAdmin/system/setting', {
            settings,
            success_message: req.query.success
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.render('vwAdmin/system/setting', {
            settings: { ...DEFAULT_SETTINGS },
            error_message: 'Failed to load system settings'
        });
    }
};

export const postSettings = async (req, res) => {
    try {
        const { new_product_limit_minutes, auto_extend_trigger_minutes, auto_extend_duration_minutes } = req.body;
        
        await systemSettingService.updateSetting('new_product_limit_minutes', new_product_limit_minutes);
        await systemSettingService.updateSetting('auto_extend_trigger_minutes', auto_extend_trigger_minutes);
        await systemSettingService.updateSetting('auto_extend_duration_minutes', auto_extend_duration_minutes);
        
        res.redirect('/admin/system/settings?success=Settings updated successfully');
    } catch (error) {
        console.error('Error updating settings:', error);
        const settings = await getSettingsWithDefaults();
        res.render('vwAdmin/system/setting', {
            settings,
            error_message: 'Failed to update settings. Please try again.'
        });
    }
};
