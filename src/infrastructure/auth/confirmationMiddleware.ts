import { NextFunction } from 'express'
import { Request, Response } from 'express'
import { AppError } from '@/domain/errors/AppError.js'

export const confirmationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!

    if (!user.isConfirmed) {
      throw new AppError('Почта не подтверждена', 403)
    }

    next()
  } catch (error) {
    next(error)
  }
}
