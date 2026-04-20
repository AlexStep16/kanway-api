import express, { Router } from 'express'
import ArchiveController from '@controllers/ArchiveController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'

export default (controller: ArchiveController): Router => {
  const router = express.Router()

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/tasks', controller.getAllArchivedTasks.bind(controller))
  router.get('/categories', controller.getAllArchivedCategories.bind(controller))
  router.get('/boards', controller.getAllArchivedBoards.bind(controller))
  router.get('/workspaces', controller.getAllArchivedWorkspaces.bind(controller))

  return router
}
