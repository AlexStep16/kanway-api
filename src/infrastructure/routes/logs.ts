import LogController from "../Controllers/Log.ts"
import express from 'express';

const router = express.Router()

router
  .post('/', LogController.saveFeedback)

export default router;