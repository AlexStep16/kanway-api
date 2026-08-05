import { AppError } from '@errors/AppError.js'
import { Request, Response, NextFunction } from 'express'
import * as Sentry from '@sentry/node'
import { ValidationError } from '@/domain/errors/ValidationError.js'
import { UserNotFoundError } from '@/domain/errors/UserAuthError.js'
import { serialize } from 'cookie'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export const globalErrorHandler = (err: any, _r: Request, res: Response, _n: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(err)
  }

  if (err instanceof UserNotFoundError) {
    res.setHeader(
      'Set-Cookie',
      serialize('token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      }),
    )

    return res.status(401).json({
      success: false,
      error: {
        code: 401,
        description: ErrorMessages.USER_NOT_AUTHORIZED,
      },
    })
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
      description: 'Непредвиденная ошибка сервера',
    },
  })
}
