import { Request, Response, NextFunction } from 'express'
import { AppError } from '@/domain/errors/AppError.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import jwt from 'jsonwebtoken'
import { ProviderDTO } from '@/application/dtos/ProviderDTO.js'

const JWT_SECRET = process.env.JWT_KEY || 'FF123ABC-456D-789E-F012-3456789ABCDF'

export const validateFinishSignupToken = (req: Request, _: Response, next: NextFunction) => {
  try {
    const token = req.cookies.finish_sign_up_token

    if (!token) {
      return next(new AppError(ErrorMessages.SESSION_EXPIRED, 401))
    }

    const decoded = jwt.verify(token, JWT_SECRET) as ProviderDTO

    if (!decoded) {
      return next(new AppError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED, 401))
    }

    req.providerData = decoded

    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(ErrorMessages.SESSION_EXPIRED, 401))
    }

    next(new AppError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED, 401))
  }
}
