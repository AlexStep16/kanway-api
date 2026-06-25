import { TokenService } from '@application/services/TokenService.js'
import { IUser } from '@/domain/entities/IUser.js'
import { Redis } from 'ioredis'
import { AppError } from '@/domain/errors/AppError.js'
import { TokenKeysEnum } from '@/domain/enums/TokenKeysEnum.js'
import crypto from 'crypto'
import { AllowedAuthStepsEnum } from '@/enums/AllowedAuthStepsEnum.js'
import { Resend } from 'resend'

const SEND_INTERVAL = 60
const SLACK_TIME = 2
const CHALLENGE_TTL = 900

type EmailChallenge = {
  code: string
  userId: string
  token: string
}

export class EmailService {
  protected tokenService: TokenService

  private resend: Resend
  private redis: Redis

  constructor(tokenService: TokenService) {
    this.tokenService = tokenService
    this.resend = new Resend(process.env.RESEND_SECRET || '')
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    })
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
  }

  private async lockSend(limitKey: string, interval: number) {
    const result = await this.redis.set(limitKey, 'locked', 'EX', interval, 'NX')

    if (result) return

    const ttl = await this.redis.ttl(limitKey)
    throw new AppError(
      `Слишком много запросов. Попробуйте через ${Math.max(ttl, 1)} секунд(ы).`,
      429,
    )
  }

  public async sendMagicLink(user: IUser) {
    const token = crypto.randomBytes(32).toString('hex')
    const normalizedEmail = this.normalizeEmail(user.email)

    const linkKey = `${TokenKeysEnum.LOGIN_VERIFICATION}:${token}`
    const otpKey = `${TokenKeysEnum.LOGIN_OTP_VERIFICATION}:${normalizedEmail}`
    const limitKey = `limit:${TokenKeysEnum.LOGIN_VERIFICATION}:${normalizedEmail}`

    await this.lockSend(limitKey, SEND_INTERVAL)

    const previousChallengeRaw = await this.redis.get(otpKey)
    const previousChallenge = previousChallengeRaw
      ? (JSON.parse(previousChallengeRaw) as EmailChallenge)
      : null

    const encodedEmail = Buffer.from(normalizedEmail).toString('base64')
    const magicLink = `https://kanway.ru/auth?step=${AllowedAuthStepsEnum.VERIFY_LOGIN}&payload=${encodeURIComponent(encodedEmail)}&token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await this.redis
      .multi()
      .set(linkKey, normalizedEmail, 'EX', CHALLENGE_TTL)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', CHALLENGE_TTL)
      .exec()

    if (process.env.NODE_ENV === 'development') {
      console.log(otpCode, token)
      return
    }

    try {
      await this.resend.emails.send({
        to: normalizedEmail,
        template: {
          id: 'kanway-login-code',
          variables: {
            otpCode,
            magicLink,
          },
        },
      })

      if (previousChallenge?.token) {
        await this.redis.del(`${TokenKeysEnum.LOGIN_VERIFICATION}:${previousChallenge.token}`)
      }
    } catch (err: unknown) {
      await Promise.all([this.redis.del(limitKey), this.redis.del(otpKey), this.redis.del(linkKey)])
      throw err
    }
  }

  public async sendVerifyEmailToUser(user: IUser) {
    const token = crypto.randomBytes(32).toString('hex')
    const normalizedEmail = this.normalizeEmail(user.email)

    const linkKey = `${TokenKeysEnum.EMAIL_VERIFICATION}:${token}`
    const otpKey = `${TokenKeysEnum.EMAIL_OTP_VERIFICATION}:${normalizedEmail}`
    const limitKey = `limit:${TokenKeysEnum.EMAIL_VERIFICATION}:${normalizedEmail}`

    await this.lockSend(limitKey, SEND_INTERVAL)

    const previousChallengeRaw = await this.redis.get(otpKey)
    const previousChallenge = previousChallengeRaw
      ? (JSON.parse(previousChallengeRaw) as EmailChallenge)
      : null

    const encodedEmail = Buffer.from(normalizedEmail).toString('base64')
    const verificationUrl = `https://kanway.ru/auth?step=${AllowedAuthStepsEnum.VERIFY_EMAIL}&payload=${encodeURIComponent(encodedEmail)}&token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await this.redis
      .multi()
      .set(linkKey, normalizedEmail, 'EX', CHALLENGE_TTL)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', CHALLENGE_TTL)
      .exec()
    if (process.env.NODE_ENV === 'development') {
      console.log(otpCode, token)
      return
    }
    try {
      await this.resend.emails.send({
        to: normalizedEmail,
        template: {
          id: 'email-confirmation',
          variables: {
            otpCode,
            verificationUrl,
          },
        },
      })

      if (previousChallenge?.token) {
        await this.redis.del(`${TokenKeysEnum.EMAIL_VERIFICATION}:${previousChallenge.token}`)
      }
    } catch (err: unknown) {
      await Promise.all([this.redis.del(limitKey), this.redis.del(linkKey), this.redis.del(otpKey)])

      throw err
    }
  }

  public async sendPasswordRecoveryEmailToUser(user: IUser) {
    const token = crypto.randomBytes(32).toString('hex')
    const normalizedEmail = this.normalizeEmail(user.email)

    const linkKey = `${TokenKeysEnum.PASSWORD_RECOVERY}:${token}`
    const otpKey = `${TokenKeysEnum.PASSWORD_OTP_RECOVERY}:${normalizedEmail}`
    const limitKey = `limit:${TokenKeysEnum.PASSWORD_RECOVERY}:${normalizedEmail}`

    await this.lockSend(limitKey, SEND_INTERVAL - SLACK_TIME)

    const previousChallengeRaw = await this.redis.get(otpKey)
    const previousChallenge = previousChallengeRaw
      ? (JSON.parse(previousChallengeRaw) as EmailChallenge)
      : null

    const encodedEmail = Buffer.from(normalizedEmail).toString('base64')
    const recoveryUrl = `https://kanway.ru/auth?step=${AllowedAuthStepsEnum.VERIFY_PASSWORD}&payload=${encodeURIComponent(encodedEmail)}&token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await this.redis
      .multi()
      .set(linkKey, normalizedEmail, 'EX', CHALLENGE_TTL)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', CHALLENGE_TTL)
      .exec()
    if (process.env.NODE_ENV === 'development') {
      console.log(otpCode, token)
      return
    }
    try {
      await this.resend.emails.send({
        to: normalizedEmail,
        template: {
          id: 'password-reset-code',
          variables: {
            otpCode,
            recoveryLink: recoveryUrl,
          },
        },
      })

      if (previousChallenge?.token) {
        await this.redis.del(`${TokenKeysEnum.PASSWORD_RECOVERY}:${previousChallenge.token}`)
      }
    } catch (err: unknown) {
      await Promise.all([this.redis.del(limitKey), this.redis.del(linkKey), this.redis.del(otpKey)])
      throw err
    }
  }

  public async sendSupportEmail(
    theme: string,
    details: string,
    userEmail: string,
    userName: string,
  ) {
    const normalizedEmail = this.normalizeEmail(userEmail)
    const key = `limit:support:${normalizedEmail}`

    await this.lockSend(key, 10)

    try {
      await this.resend.emails.send({
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
      await this.redis.del(key)
      throw err
    }
  }

  public async sendPaymentFailedEmail(user: IUser, amount: string, days: string) {
    await this.resend.emails.send({
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
    await this.resend.emails.send({
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
    await this.resend.emails.send({
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
    await this.resend.emails.send({
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
