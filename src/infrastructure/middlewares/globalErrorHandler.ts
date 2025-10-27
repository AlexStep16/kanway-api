import { AppError } from '@errors/AppError.ts'
import { Request, Response, NextFunction } from 'express'

export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(err)
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.statusCode,
        description: err.message,
      },
    })
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 500,
      description: 'Непредвиденная ошибка сервера.',
    },
  })
}
