import SpeechController from "../Controllers/Speech.ts"
import express from 'express';

const router = express.Router()

router
  .get('/get-ephemeral-key', SpeechController.getEphemeralKey);

export default router;