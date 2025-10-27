import { Application } from 'express'
import express from 'express'
import cors from 'cors'

import auth from '@routes/auth.ts'

//import UserController from './Controllers/User.ts'
//import { initWorkspace } from '@middlewares/Workspace.ts'
import cookieParser from 'cookie-parser'
import { initializeDependencies } from '@infrastructure/di/initializeDependencies.ts'

export function attachRoutes(app: Application) {
  const frontUrl = process.env.FRONT_URL || 'https://kanbar.ru'
  const frontUrlWithoutProtocol = frontUrl.split('https://')[1]

  const dependencies = initializeDependencies()

  app.use(
    cors({
      origin: [frontUrl, 'https://www.' + frontUrlWithoutProtocol, 'http://localhost:3001'],
      credentials: true,
    })
  )
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }))
  app.use(cookieParser())

  app.use('/auth', auth(dependencies.controllers.authController))
}
