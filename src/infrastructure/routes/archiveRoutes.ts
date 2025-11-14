import express, { Router } from 'express'
import ArchiveController from '@controllers/ArchiveController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'

export default (controller: ArchiveController): Router => {
  const router = express.Router()

  router.use(jwtAuthMiddleware)

  router.get('/tasks', controller.getAllArchivedTasks.bind(controller))
  router.get('/categories', controller.getAllArchivedCategories.bind(controller))
  router.get('/boards', controller.getAllArchivedBoards.bind(controller))
  router.get('/workspaces', controller.getAllArchivedWorkspaces.bind(controller))

  return router
}
