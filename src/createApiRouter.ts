import { Router } from 'express'

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

import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'
import supportRoutes from './infrastructure/routes/supportRoutes.ts'
import paymentNotificationRoutes from './infrastructure/routes/paymentNotificationRoutes.ts'
import { authLimiter } from '@/limiters.ts'

export const createApiRouter = (): Router => {
  const apiRouter = Router()

  const dependencies = initializeDependencies()

  apiRouter.use('/auth', authLimiter, authRoutes(dependencies.controllers.authController))
  apiRouter.use('/support', supportRoutes(dependencies.controllers.supportController))
  apiRouter.use('/workspaces', workspaceRoutes(dependencies.controllers.workspaceController))
  apiRouter.use('/boards', boardRoutes(dependencies.controllers.boardController))
  apiRouter.use('/categories', categoryRoutes(dependencies.controllers.categoryController))
  apiRouter.use('/tasks', taskRoutes(dependencies.controllers.taskController))
  apiRouter.use('/chats', chatRoutes(dependencies.controllers.chatController))
  apiRouter.use('/chat-messages', chatMessageRoutes(dependencies.controllers.chatMessageController))
  apiRouter.use('/archive', archiveRoutes(dependencies.controllers.archiveController))
  apiRouter.use('/settings', settingRoutes(dependencies.controllers.settingController))
  apiRouter.use(
    '/subscriptions',
    subscriptionRoutes(dependencies.controllers.subscriptionController),
  )
  apiRouter.use('/payments', paymentRoutes(dependencies.controllers.paymentController))
  apiRouter.use(
    '/payment-notifications',
    paymentNotificationRoutes(dependencies.controllers.paymentController),
  )
  apiRouter.use(
    '/payment-methods',
    paymentMethodRoutes(dependencies.controllers.paymentMethodController),
  )
  apiRouter.use(
    '/operation-logs',
    operationLogRoutes(dependencies.controllers.operationLogController),
  )
  apiRouter.use('/me', userRoutes(dependencies.controllers.userController))

  return apiRouter
}
