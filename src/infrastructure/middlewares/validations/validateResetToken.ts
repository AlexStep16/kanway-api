import { Request, Response, NextFunction } from 'express'
import { AppError } from '@/domain/errors/AppError.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_KEY || 'FF123ABC-456D-789E-F012-3456789ABCDF'

export const validateResetToken = (req: Request, _: Response, next: NextFunction) => {
  try {
    const token = req.cookies.reset_token

    if (!token) {
      return next(new AppError(ErrorMessages.SESSION_EXPIRED, 401))
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { user_id: string }

    if (!decoded || !decoded.user_id) {
      return next(new AppError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED, 401))
    }

    req.userId = decoded.user_id

    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(ErrorMessages.SESSION_EXPIRED, 401))
    }

    next(new AppError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED, 401))
  }
}
