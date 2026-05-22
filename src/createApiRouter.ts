import { Router } from 'express'

import authRoutes from '@routes/authRoutes.js'
import workspaceRoutes from '@routes/workspaceRoutes.js'
import boardRoutes from '@routes/boardRoutes.js'
import categoryRoutes from '@routes/categoryRoutes.js'
import taskRoutes from '@routes/taskRoutes.js'
import archiveRoutes from '@routes/archiveRoutes.js'
import settingRoutes from '@routes/settingRoutes.js'
import userRoutes from '@routes/userRoutes.js'
import subscriptionRoutes from '@routes/subscriptionRoutes.js'
import paymentRoutes from '@routes/paymentRoutes.js'
import paymentMethodRoutes from '@routes/paymentMethodRoutes.js'
import operationLogRoutes from '@routes/operationLogRoutes.js'
import chatRoutes from '@routes/chatRoutes.js'
import chatMessageRoutes from '@routes/chatMessageRoutes.js'

import { initializeDependencies } from '@infrastructure/di/initializeDependencies.js'
import supportRoutes from './infrastructure/routes/supportRoutes.js'
import paymentNotificationRoutes from './infrastructure/routes/paymentNotificationRoutes.js'
import { authLimiter } from '@/limiters.js'

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

  //apiRouter.use('/sandbox', sandboxRoutes(dependencies.controllers.sandboxController))

  return apiRouter
}
