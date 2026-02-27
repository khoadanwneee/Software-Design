import * as systemSettingModel from '../models/systemSetting.model.js';

/**
 * SYSTEM SETTING SERVICE
 */

export function getAllSettings() {
  return systemSettingModel.getAllSettings();
}

export function updateSetting(key, value) {
  return systemSettingModel.updateSetting(key, value);
}
