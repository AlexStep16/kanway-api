import passport from 'passport'
import { Request } from 'express'
import { Strategy as JwtStrategy } from 'passport-jwt'
import { UserService } from '@application/services/UserService.ts'
import UserRepository from '@repositories/UserRepository.ts'
import * as Sentry from '@sentry/node'

const KEY = process.env.JWT_KEY || 'FF123ABC-456D-789E-F012-3456789ABCDF'

const cookieExtractor = (req: Request) => {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token
  }
  return null
}

// 2. Настройка стратегии
const jwtOptions = {
  jwtFromRequest: cookieExtractor,
  secretOrKey: KEY,
}

passport.use(
  new JwtStrategy(
    jwtOptions,
    async (jwtPayload: { user_id: string }, done: (err: any, user?: any) => void) => {
      try {
        const userRepository = new UserRepository()
        const userService = new UserService(userRepository)

        const user = await userService.getById(jwtPayload.user_id)

        if (!user) {
          return done(null, false)
        }

        return done(null, user)
      } catch (err) {
        Sentry.captureException(err)

        return done(err)
      }
    }
  )
)

export const jwtAuthMiddleware = passport.authenticate('jwt', { session: false })
