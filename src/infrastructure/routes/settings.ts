import express from 'express'

const router = express.Router()

router
  .post('/', SettingValidator.edit, SettingController.saveSettings)
  .get('/', SettingController.getSettings)

export default router
