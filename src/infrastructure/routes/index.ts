import { Application } from 'express'
import express from 'express'
import cors from 'cors'

import authRoutes from '@routes/authRoutes.ts'
import workspaceRoutes from '@routes/workspaceRoutes.ts'
import boardRoutes from '@routes/boardRoutes.ts'
import categoryRoutes from '@routes/categoryRoutes.ts'
import taskRoutes from '@routes/taskRoutes.ts'
import archiveRoutes from '@routes/archiveRoutes.ts'
import settingRoutes from '@routes/settingRoutes.ts'
import userRoutes from '@routes/userRoutes.ts'
import subscriptionRoutes from '@routes/subscriptionRoutes.ts'
import paymentRoutes from '@routes/paymentRoutes.ts'
import paymentMethodRoutes from '@routes/paymentMethodRoutes.ts'
import operationLogRoutes from '@routes/operationLogRoutes.ts'
import chatRoutes from '@routes/chatRoutes.ts'
import chatMessageRoutes from '@routes/chatMessageRoutes.ts'

import cookieParser from 'cookie-parser'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'
import path from 'path'

export function attachRoutes(app: Application) {
  const frontUrl = process.env.FRONT_URL || 'https://kanbar.ru'
  const frontUrlWithoutProtocol = frontUrl.split('https://')[1]

  const dependencies = initializeDependencies()

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  app.use(
    cors({
      origin: [frontUrl, 'https://www.' + frontUrlWithoutProtocol, 'http://localhost:3001'],
      credentials: true,
    })
  )
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }))
  app.use(cookieParser())

  app.use('/auth', authRoutes(dependencies.controllers.authController))
  app.use('/workspaces', workspaceRoutes(dependencies.controllers.workspaceController))
  app.use('/workspaces/:workspaceId/boards', boardRoutes(dependencies.controllers.boardController))
  app.use(
    '/workspaces/:workspaceId/boards/:boardId/categories',
    categoryRoutes(dependencies.controllers.categoryController)
  )
  app.use(
    '/workspaces/:workspaceId/boards/:boardId/tasks',
    taskRoutes(dependencies.controllers.taskController)
  )

  app.use('/workspaces/:workspaceId/chats', chatRoutes(dependencies.controllers.chatController))

  app.use(
    '/workspaces/:workspaceId/chat-messages',
    chatMessageRoutes(dependencies.controllers.chatMessageController)
  )

  app.use('/archive', archiveRoutes(dependencies.controllers.archiveController))

  app.use('/settings', settingRoutes(dependencies.controllers.settingController))

  app.use('/subscriptions', subscriptionRoutes(dependencies.controllers.subscriptionController))

  app.use('/payments', paymentRoutes(dependencies.controllers.paymentController))

  app.use('/payment-methods', paymentMethodRoutes(dependencies.controllers.paymentMethodController))

  app.use('/operation-logs', operationLogRoutes(dependencies.controllers.operationLogController))

  app.use('/me', userRoutes(dependencies.controllers.userController))
}
