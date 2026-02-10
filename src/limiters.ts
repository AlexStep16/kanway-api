import { RedisStore, type RedisReply } from 'rate-limit-redis'
import { Redis } from 'ioredis'
import { Request, Response } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { AppError } from './domain/errors/AppError.ts'

const redis = new Redis()

const baseHandler = (req: Request, _res: Response, next: Function) => {
  if (req.rateLimit) {
    const retryAfter = req.rateLimit.resetTime
      ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
      : 60

    next(
      new AppError(
        `Слишком много запросов. Пожалуйста, попробуйте через ${retryAfter} секунд.`,
        429,
      ),
    )
  } else {
    next(new AppError('Слишком много запросов. Пожалуйста, попробуйте позже.', 429))
  }
}

const keyGenerator = (req: Request) => {
  if (req.user) return req.user.id.toString()
  else if (req.ip) return ipKeyGenerator(req.ip)
  else return 'anonymous'
}

const createLimiter = (max: number, prefix: string, windowMs = 60 * 1000) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false },
    keyGenerator,
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) =>
        redis.call(command, ...args) as Promise<RedisReply>,
      prefix: `rl:${prefix}:`,
    }),
    handler: baseHandler,
    skip: (req) =>
      req.ip === '127.0.0.1' ||
      req.headers['x-internal-key'] === (process.env.SKIP_LIMITER_SECRET || '25546466'),
  })
}

// Теперь создание лимитеров выглядит очень лаконично:
export const generalLimiter = createLimiter(150, 'general')
export const authLimiter = createLimiter(15, 'auth')
export const emailLimiter = createLimiter(5, 'email', 15 * 60 * 1000)
export const postEntitiesLimiter = createLimiter(20, 'postentities')
export const postTasksLimiter = createLimiter(40, 'posttasks')
export const patchEntitiesLimiter = createLimiter(50, 'patchentities')
export const patchTasksLimiter = createLimiter(100, 'patchtasks')
export const patchUserLimiter = createLimiter(5, 'patchuser')
export const supportLimiter = createLimiter(3, 'support')
export const aiLimiter = createLimiter(5, 'ai')
