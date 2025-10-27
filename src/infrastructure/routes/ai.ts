import express from 'express'

const router = express.Router()

router
  .post('/stream', AIValidator.generate, AIController2.generate)
  .get('/stream/:threadId/status', AIController2.streamStatus)
  .put('/stream/:threadId/review', AIController2.reviewToolsAgent)
  .get('/chats', AIController2.getChats)
  .get('/chat-history/:threadId', AIController2.getChatHistory)

export default router
