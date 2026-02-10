import { AppError } from '@errors/AppError.ts'
import { Request, Response, NextFunction } from 'express'
import * as Sentry from '@sentry/node'
import { ValidationError } from '@/domain/errors/ValidationError.ts'

export const globalErrorHandler = (err: any, _r: Request, res: Response, _n: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(err)
  }

  if (err instanceof AppError || err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.statusCode,
        description: err.message,
      },
    })
  }

  if (!(err instanceof AppError) || (err instanceof AppError && err.statusCode === 500))
    Sentry.captureException(err)

  return res.status(500).json({
    success: false,
    error: {
      code: 500,
      description: 'Непредвиденная ошибка сервера.',
    },
  })
}
