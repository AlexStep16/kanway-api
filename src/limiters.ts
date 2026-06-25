import { RedisStore, type RedisReply } from 'rate-limit-redis'
import { Redis } from 'ioredis'
import { NextFunction, Request, Response } from 'express'
import { type ValueDeterminingMiddleware, rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { AppError } from './domain/errors/AppError.js'

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
})

type KeyGenerator = ValueDeterminingMiddleware<string>

type LimiterOptions = {
  max: number
  prefix: string
  windowMs?: number
  keyGenerator?: KeyGenerator
}

const DEFAULT_RETRY_AFTER_SECONDS = 60

const normalizeEmail = (email: unknown): string | null => {
  if (typeof email !== 'string') return null

  const normalizedEmail = email.toLowerCase().trim()

  return normalizedEmail.length > 0 ? normalizedEmail : null
}

const getIpPart = (req: Request): string => {
  if (!req.ip) return 'anonymous'

  return ipKeyGenerator(req.ip)
}

const buildCompositeKey = (prefix: string, req: Request): string => {
  return `${prefix}:${getIpPart(req)}`
}

const getUserOrIpKey = (req: Request): string => {
  if (req.user) return `user:${req.user.id.toString()}`

  return buildCompositeKey('ip', req)
}

const userOrIpKeyGenerator: KeyGenerator = (req) => {
  return getUserOrIpKey(req)
}

const emailAndIpKeyGenerator: KeyGenerator = (req) => {
  const email = normalizeEmail(req.body?.email)

  if (email) return buildCompositeKey(`email:${email}`, req)

  if (req.user?.email) return buildCompositeKey(`email:${normalizeEmail(req.user.email)}`, req)

  return getUserOrIpKey(req)
}

const tokenAndIpKeyGenerator: KeyGenerator = (req) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''

  if (token.length > 0) return buildCompositeKey(`token:${token}`, req)

  return getUserOrIpKey(req)
}

const internalLimiterSecret = process.env.SKIP_LIMITER_SECRET

const skipLimiter = (req: Request): boolean => {
  if (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1') {
    return true
  }

  if (!internalLimiterSecret) return false

  return req.headers['x-internal-key'] === internalLimiterSecret
}

const baseHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (req.rateLimit) {
    const retryAfter = req.rateLimit.resetTime
      ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
      : DEFAULT_RETRY_AFTER_SECONDS

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

const createLimiter = ({
  max,
  prefix,
  windowMs = 60 * 1000,
  keyGenerator = userOrIpKeyGenerator,
}: LimiterOptions) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: new RedisStore({
      sendCommand: (command: string, ...args: string[]) =>
        redis.call(command, ...args) as Promise<RedisReply>,
      prefix: `rl:${prefix}:`,
    }),
    handler: baseHandler,
    skip: skipLimiter,
  })
}

export const generalLimiter = createLimiter({ max: 150, prefix: 'general' })
export const signupLimiter = createLimiter({ max: 10, prefix: 'auth:signup' })
export const signinLimiter = createLimiter({
  max: 10,
  prefix: 'auth:signin',
  keyGenerator: emailAndIpKeyGenerator,
})
export const socialAuthLimiter = createLimiter({ max: 20, prefix: 'auth:social' })
export const emailSendLimiter = createLimiter({
  max: 5,
  prefix: 'auth:email-send',
  windowMs: 15 * 60 * 1000,
  keyGenerator: emailAndIpKeyGenerator,
})
export const tokenVerifyLimiter = createLimiter({
  max: 20,
  prefix: 'auth:token-verify',
  keyGenerator: tokenAndIpKeyGenerator,
})
export const otpVerifyLimiter = createLimiter({
  max: 10,
  prefix: 'auth:otp-verify',
  keyGenerator: emailAndIpKeyGenerator,
})
export const emailCheckLimiter = createLimiter({
  max: 10,
  prefix: 'auth:email-check',
  keyGenerator: emailAndIpKeyGenerator,
})
export const postEntitiesLimiter = createLimiter({ max: 20, prefix: 'postentities' })
export const postTasksLimiter = createLimiter({ max: 40, prefix: 'posttasks' })
export const patchEntitiesLimiter = createLimiter({ max: 50, prefix: 'patchentities' })
export const patchTasksLimiter = createLimiter({ max: 100, prefix: 'patchtasks' })
export const patchUserLimiter = createLimiter({ max: 5, prefix: 'patchuser' })
export const supportLimiter = createLimiter({
  max: 3,
  prefix: 'support',
  keyGenerator: emailAndIpKeyGenerator,
})
export const aiLimiter = createLimiter({ max: 5, prefix: 'ai' })
