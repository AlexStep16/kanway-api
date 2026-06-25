import { TokenService } from '@application/services/TokenService.js'
import { IUser } from '@/domain/entities/IUser.js'
import { Redis } from 'ioredis'
import { AppError } from '@/domain/errors/AppError.js'
import { TokenKeysEnum } from '@/domain/enums/TokenKeysEnum.js'
import crypto from 'crypto'
import { AllowedAuthStepsEnum } from '@/enums/AllowedAuthStepsEnum.js'
import { Resend } from 'resend'

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
})

const resend = new Resend(process.env.RESEND_SECRET || '')

const SEND_INTERVAL = 60
const SLACK_TIME = 2

export class EmailService {
  protected tokenService: TokenService

  constructor(tokenService: TokenService) {
    this.tokenService = tokenService
  }

  public async sendMagicLink(user: IUser) {
    const token = crypto.randomBytes(32).toString('hex')

    const linkKey = `${TokenKeysEnum.LOGIN_VERIFICATION}:${token}`
    const otpKey = `${TokenKeysEnum.LOGIN_OTP_VERIFICATION}:${user.email}`
    const limitKey = `limit:${TokenKeysEnum.LOGIN_VERIFICATION}:${user.email}`

    const ttl = await redis.ttl(limitKey)

    if (ttl > 0) {
      throw new AppError(`Слишком много запросов. Попробуйте через ${ttl} секунд(ы).`, 429)
    }

    const encodedEmail = Buffer.from(user.email).toString('base64')
    const magicLink = `https://kanway.ru/auth?step=${AllowedAuthStepsEnum.VERIFY_LOGIN}&payload=${encodeURIComponent(encodedEmail)}&token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await redis
      .multi()
      .set(limitKey, 'locked', 'EX', SEND_INTERVAL)
      .set(linkKey, user.id.toString(), 'EX', 600)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', 600)
      .exec()

    if (process.env.NODE_ENV === 'development') {
      console.log(otpCode, token)
      return
    }

    try {
      await resend.emails.send({
        to: user.email,
        template: {
          id: 'kanway-login-code',
          variables: {
            otpCode,
            magicLink,
          },
        },
      })
    } catch (err: unknown) {
      await Promise.all([redis.del(limitKey), redis.del(otpKey), redis.del(linkKey)])
      throw err
    }
  }

  public async sendVerifyEmailToUser(user: IUser) {
    const token = crypto.randomBytes(32).toString('hex')

    const linkKey = `${TokenKeysEnum.EMAIL_VERIFICATION}:${token}`
    const otpKey = `${TokenKeysEnum.EMAIL_OTP_VERIFICATION}:${user.email}`
    const limitKey = `limit:${TokenKeysEnum.EMAIL_VERIFICATION}:${user.email}`

    const ttl = await redis.ttl(limitKey)

    if (ttl > 0) {
      throw new AppError(`Слишком много запросов. Попробуйте через ${ttl} секунд(ы).`, 429)
    }
    const encodedEmail = Buffer.from(user.email).toString('base64')
    const verificationUrl = `https://kanway.ru/auth?step=${AllowedAuthStepsEnum.VERIFY_EMAIL}&payload=${encodeURIComponent(encodedEmail)}&token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await redis
      .multi()
      .set(limitKey, 'locked', 'EX', SEND_INTERVAL)
      .set(linkKey, user.id.toString(), 'EX', 600)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', 600)
      .exec()
    if (process.env.NODE_ENV === 'development') {
      console.log(otpCode, token)
      return
    }
    try {
      await resend.emails.send({
        to: user.email,
        template: {
          id: 'email-confirmation',
          variables: {
            otpCode,
            verificationUrl,
          },
        },
      })
    } catch (err: unknown) {
      await Promise.all([redis.del(limitKey), redis.del(linkKey), redis.del(otpKey)])

      throw err
    }
  }

  public async sendPasswordRecoveryEmailToUser(user: IUser) {
    const token = crypto.randomBytes(32).toString('hex')

    const linkKey = `${TokenKeysEnum.PASSWORD_RECOVERY}:${token}`
    const otpKey = `${TokenKeysEnum.PASSWORD_OTP_RECOVERY}:${user.email}`
    const limitKey = `limit:${TokenKeysEnum.PASSWORD_RECOVERY}:${user.email}`

    const ttl = await redis.ttl(limitKey)

    if (ttl > 0) {
      throw new AppError(`Слишком много запросов. Попробуйте через ${ttl} секунд(ы).`, 429)
    }

    const encodedEmail = Buffer.from(user.email).toString('base64')
    const recoveryUrl = `https://kanway.ru/auth?step=${AllowedAuthStepsEnum.VERIFY_PASSWORD}&payload=${encodeURIComponent(encodedEmail)}&token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await redis
      .multi()
      .set(limitKey, 'locked', 'EX', SEND_INTERVAL - SLACK_TIME)
      .set(linkKey, user.id.toString(), 'EX', 600)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', 600)
      .exec()
    if (process.env.NODE_ENV === 'development') {
      console.log(otpCode, token)
      return
    }
    try {
      await resend.emails.send({
        to: user.email,
        template: {
          id: 'password-reset-code',
          variables: {
            otpCode,
            recoveryLink: recoveryUrl,
          },
        },
      })
    } catch (err: unknown) {
      await Promise.all([redis.del(limitKey), redis.del(linkKey), redis.del(otpKey)])
      throw err
    }
  }

  public async sendSupportEmail(
    theme: string,
    details: string,
    userEmail: string,
    userName: string,
  ) {
    const key = `limit:support`

    const ttl = await redis.ttl(key)

    if (ttl > 0) {
      throw new AppError(`Слишком много запросов. Попробуйте через ${ttl} секунд(ы).`, 429)
    }

    await redis.set(key, 'locked', 'EX', 10)

    try {
      await resend.emails.send({
        to: 'alexander.work2020@gmail.com',
        template: {
          id: 'support-message',
          variables: {
            theme,
            name: userName,
            email: userEmail,
            details,
          },
        },
      })
    } catch (err: unknown) {
      await redis.del(key)
      throw err
    }
  }

  public async sendPaymentFailedEmail(user: IUser, amount: string, days: string) {
    await resend.emails.send({
      to: user.email,
      template: {
        id: 'payment-issue',
        variables: {
          amount,
          days,
        },
      },
    })
  }

  public async sendPaymentFinalFailedEmail(user: IUser) {
    await resend.emails.send({
      to: user.email,
      template: {
        id: 'payment-issue-1',
      },
    })
  }

  public async sendPaymentSubSuccessEmail(
    user: IUser,
    data: {
      purpose: string
      amount: string
      date: string
      next_billing_date: string
    },
  ) {
    await resend.emails.send({
      to: user.email,
      template: {
        id: 'subscription-payment-success',
        variables: {
          purpose: data.purpose,
          amount: data.amount,
          date: data.date,
          nextBillingDate: data.next_billing_date,
        },
      },
    })
  }

  public async sendPaymentCreditsSuccessEmail(
    user: IUser,
    data: {
      purpose: string
      amount: string
      date: string
    },
  ) {
    await resend.emails.send({
      to: user.email,
      template: {
        id: 'purchase-confirmation',
        variables: {
          purpose: data.purpose,
          amount: data.amount,
          date: data.date,
        },
      },
    })
  }
}
