import express from 'express'
import multer from 'multer'

const router = express.Router()
const upload = multer({ dest: 'uploads/' })

router
  .post('/avatar', upload.single('file'), UserController.uploadPhoto)
  .post('/', UserValidator.validateUsername, UserController.update)

export default router
