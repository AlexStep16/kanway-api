import { Router } from 'express'
import SandboxController from '../api/controllers/SandboxController.js'

export default (controller: SandboxController): Router => {
  const router = Router({ mergeParams: true })

  router.post('/tool/execute', controller.executeTool)
  router.post('/test', controller.test)

  return router
}
