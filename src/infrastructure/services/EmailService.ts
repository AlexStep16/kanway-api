import { TokenService } from '@application/services/TokenService.js'
import path from 'path'
import * as Sentry from '@sentry/node'
import * as fs from 'node:fs'
import { IUser } from '@/domain/entities/IUser.js'
import { Redis } from 'ioredis'
import { AppError } from '@/domain/errors/AppError.js'
import dayjs from 'dayjs'
import { TokenKeysEnum } from '@/domain/enums/TokenKeysEnum.js'
import crypto from 'crypto'

const redis = new Redis()

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

    const verificationUrl = `https://kanway.ru/verify-login?token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await redis
      .multi()
      .set(limitKey, 'locked', 'EX', SEND_INTERVAL)
      .set(linkKey, user.id.toString(), 'EX', 600)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', 600)
      .exec()
    console.log(token)

    try {
      const templatePath = path.resolve('email-templates/verify-login.html')

      const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

      const inputBody = {
        message: {
          recipients: [
            {
              email: user.email,
              substitutions: {
                confirmation_link: verificationUrl,
                otp_code: otpCode,
              },
            },
          ],
          body: {
            html: htmlContent,
            plaintext: `Код подтверждения: ${otpCode}`,
          },
          subject: 'Код для входа в Kanway',
          from_email: 'noreply@kanway.ru',
          from_name: 'Kanway',
          track_links: 0,
          track_read: 0,
        },
      }

      /*const response = await fetch(
        'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-KEY': process.env.UNISENDER_API_KEY || '',
          },
          body: JSON.stringify(inputBody),
        },
      )

      const responseBody = await response.json()

      if (responseBody?.status === 'error')
        Sentry.captureException(new AppError(responseBody.message, 500))*/
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
    const verificationUrl = `https://kanway.ru/verify-email?token=${token}`
    const otpCode = crypto.randomInt(100000, 999999).toString()

    await redis
      .multi()
      .set(limitKey, 'locked', 'EX', SEND_INTERVAL)
      .set(linkKey, user.id.toString(), 'EX', 600)
      .set(otpKey, JSON.stringify({ code: otpCode, userId: user.id, token }), 'EX', 600)
      .exec()
    console.log(token)

    try {
      const templatePath = path.resolve('email-templates/verify-email.html')

      const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

      const inputBody = {
        message: {
          recipients: [
            {
              email: user.email,
              substitutions: {
                confirmation_link: verificationUrl,
                otp_code: otpCode,
              },
            },
          ],
          body: {
            html: htmlContent,
            plaintext: `Код подтверждения: ${otpCode}`,
          },
          subject: 'Подтверждение почты',
          from_email: 'noreply@kanway.ru',
          from_name: 'Kanway',
          track_links: 0,
          track_read: 0,
        },
      }

      /*const response = await fetch(
        'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-KEY': process.env.UNISENDER_API_KEY || '',
          },
          body: JSON.stringify(inputBody),
        },
      )

      const responseBody = await response.json()

      if (responseBody?.status === 'error')
        Sentry.captureException(new AppError(responseBody.message, 500))*/
    } catch (err: unknown) {
      await Promise.all([redis.del(limitKey), redis.del(linkKey), redis.del(otpKey)])

      throw err
    }
  }

  public async sendPasswordRecoveryEmailToUser(user: IUser) {
    const token = crypto.randomBytes(32).toString('hex')

    const linkKey = `${TokenKeysEnum.PASSWORD_RECOVERY}:${token}`
    const limitKey = `limit:${TokenKeysEnum.PASSWORD_RECOVERY}:${user.email}`

    const ttl = await redis.ttl(limitKey)

    if (ttl > 0) {
      throw new AppError(`Слишком много запросов. Попробуйте через ${ttl} секунд(ы).`, 429)
    }

    const recoveryUrl = `https://kanway.ru/password-recovery?token=${token}`

    await redis
      .multi()
      .set(limitKey, 'locked', 'EX', SEND_INTERVAL - SLACK_TIME)
      .set(linkKey, user.id.toString(), 'EX', 600)
      .exec()

    console.log(token)

    try {
      const templatePath = path.resolve('email-templates/password-recovery.html')

      const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

      const inputBody = {
        message: {
          recipients: [
            {
              email: user.email,
              substitutions: {
                recovery_link: recoveryUrl,
              },
            },
          ],
          body: {
            html: htmlContent,
            plaintext: `Восстановите пароль по ссылке: ${recoveryUrl}`,
          },
          subject: 'Восстановление пароля',
          from_email: 'noreply@kanway.ru',
          from_name: 'Kanway',
          track_links: 0,
          track_read: 0,
        },
      }

      /*const response = await fetch(
        'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-KEY': process.env.UNISENDER_API_KEY || '',
          },
          body: JSON.stringify(inputBody),
        },
      )

      const responseBody = await response.json()

      if (responseBody?.status === 'error')
        Sentry.captureException(new AppError(responseBody.message, 500))*/
    } catch (err: unknown) {
      await Promise.all([redis.del(limitKey), redis.del(linkKey)])
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
      const templatePath = path.resolve('email-templates/support.html')

      const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

      const inputBody = {
        message: {
          recipients: [
            {
              email: process.env.SUPPORT_EMAIL || 'alexander.work2020@gmail.com',
              substitutions: {
                email: userEmail,
                name: userName,
                theme,
                details,
              },
            },
          ],
          body: {
            html: htmlContent,
            plaintext: `Сообщение от пользователя`,
          },
          subject: 'Сообщение в поддержку',
          from_email: 'noreply@kanway.ru',
          from_name: 'Kanway',
          track_links: 0,
          track_read: 0,
        },
      }

      const response = await fetch(
        'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-API-KEY': process.env.UNISENDER_API_KEY || '',
          },
          body: JSON.stringify(inputBody),
        },
      )

      const responseBody = await response.json()

      if (responseBody?.status === 'error')
        Sentry.captureException(new AppError(responseBody.message, 500))
    } catch (err: unknown) {
      await redis.del(key)
      throw err
    }
  }

  public async sendPaymentFailedEmail(user: IUser, amount: string, days: string) {
    const templatePath = path.resolve('email-templates/payment-failed.html')

    const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

    const inputBody = {
      message: {
        recipients: [
          {
            email: user.email,
            substitutions: {
              amount,
              days,
            },
          },
        ],
        body: {
          html: htmlContent,
          plaintext: `К сожалению, ваш платеж не прошёл.`,
        },
        subject: 'Проблема с оплатой подписки — Kanway.',
        from_email: 'noreply@kanway.ru',
        from_name: 'Kanway',
        track_links: 0,
        track_read: 0,
      },
    }

    const response = await fetch(
      'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-KEY': process.env.UNISENDER_API_KEY || '',
        },
        body: JSON.stringify(inputBody),
      },
    )

    const responseBody = await response.json()

    if (responseBody?.status === 'error')
      Sentry.captureException(new AppError(responseBody.message, 500))
  }

  public async sendPaymentFinalFailedEmail(user: IUser) {
    const templatePath = path.resolve('email-templates/payment-failed-final.html')

    const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

    const inputBody = {
      message: {
        recipients: [
          {
            email: user.email,
          },
        ],
        body: {
          html: htmlContent,
          plaintext: `К сожалению, ваш платеж не прошёл.`,
        },
        subject: 'Проблема с оплатой подписки — Kanway.',
        from_email: 'noreply@kanway.ru',
        from_name: 'Kanway',
        track_links: 0,
        track_read: 0,
      },
    }

    const response = await fetch(
      'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-KEY': process.env.UNISENDER_API_KEY || '',
        },
        body: JSON.stringify(inputBody),
      },
    )

    const responseBody = await response.json()

    if (responseBody?.status === 'error')
      Sentry.captureException(new AppError(responseBody.message, 500))
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
    const templatePath = path.resolve('email-templates/payment-success-sub.html')

    const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

    const date = dayjs(data.date).format('DD.MM.YYYY HH:mm')
    const nextBillingDate = dayjs(data.next_billing_date).format('DD.MM.YYYY 00:00')

    const inputBody = {
      message: {
        recipients: [
          {
            email: user.email,
            substitutions: {
              purpose: data.purpose,
              amount: data.amount,
              date,
              next_billing_date: nextBillingDate,
            },
          },
        ],
        body: {
          html: htmlContent,
          plaintext: `Поздравляем! Ваш платеж прошёл успешно.`,
        },
        subject: 'Успешная оплата подписки — Kanway.',
        from_email: 'noreply@kanway.ru',
        from_name: 'Kanway',
        track_links: 0,
        track_read: 0,
      },
    }

    const response = await fetch(
      'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-KEY': process.env.UNISENDER_API_KEY || '',
        },
        body: JSON.stringify(inputBody),
      },
    )

    const responseBody = await response.json()

    if (responseBody?.status === 'error')
      Sentry.captureException(new AppError(responseBody.message, 500))
  }

  public async sendPaymentCreditsSuccessEmail(
    user: IUser,
    data: {
      purpose: string
      amount: string
      date: string
    },
  ) {
    const templatePath = path.resolve('email-templates/payment-success-credits.html')

    const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

    const date = dayjs(data.date).format('DD.MM.YYYY HH:mm')

    const inputBody = {
      message: {
        recipients: [
          {
            email: user.email,
            substitutions: {
              purpose: data.purpose,
              amount: data.amount,
              date,
            },
          },
        ],
        body: {
          html: htmlContent,
          plaintext: `Поздравляем! Ваш платеж прошёл успешно.`,
        },
        subject: 'Успешная оплата кредитов — Kanway.',
        from_email: 'noreply@kanway.ru',
        from_name: 'Kanway',
        track_links: 0,
        track_read: 0,
      },
    }

    const response = await fetch(
      'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-KEY': process.env.UNISENDER_API_KEY || '',
        },
        body: JSON.stringify(inputBody),
      },
    )

    const responseBody = await response.json()

    if (responseBody?.status === 'error')
      Sentry.captureException(new AppError(responseBody.message, 500))
  }
}
