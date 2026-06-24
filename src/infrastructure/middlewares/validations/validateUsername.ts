import { Request, Response, NextFunction } from 'express'
import { AppError } from '@/domain/errors/AppError.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export const validateUsername = (req: Request, _: Response, next: NextFunction) => {
  try {
    if (req.user?.username) next()
    else throw new AppError(ErrorMessages.USERNAME_REQUIRED, 400)
  } catch (error) {
    next(error)
  }
}
