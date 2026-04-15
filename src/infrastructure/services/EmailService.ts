import TokenRepository from '@repositories/TokenRepository.js'
import { TokenService } from '@application/services/TokenService.js'
import { NotFoundError } from '@errors/NotFound.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import path from 'path'
import * as Sentry from '@sentry/node'
import * as fs from 'node:fs'
import { IUser } from '@/domain/entities/IUser.js'
import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.js'
import { Redis } from 'ioredis'
import { AppError } from '@/domain/errors/AppError.js'
import dayjs from 'dayjs'

const redis = new Redis()

const SEND_INTERVAL = 60
const SLACK_TIME = 2

export class EmailService {
  protected tokenRepository: TokenRepository
  protected tokenService: TokenService

  constructor(tokenRepository: TokenRepository, tokenService: TokenService) {
    this.tokenRepository = tokenRepository
    this.tokenService = tokenService
  }

  public async sendVerifyEmailToUser(user: IUser) {
    const key = `limit:resend_email:${user.email}_` + TokenTypesEnum.EMAIL_CONFIRMATION

    const ttl = await redis.ttl(key)

    if (ttl > 0) {
      throw new AppError(`Слишком много запросов. Попробуйте через ${ttl} секунд(ы).`, 429)
    }

    await redis.set(key, 'locked', 'EX', SEND_INTERVAL - SLACK_TIME)

    const tokenModel = await this.tokenService.generateAndSaveConfirmationToken(user.id)

    if (!tokenModel) {
      throw new NotFoundError(ErrorMessages.TOKEN_NOT_FOUND)
    }

    const verificationUrl = `https://kanway.com/verify?token=${tokenModel.token}`

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
              },
            },
          ],
          body: {
            html: htmlContent,
            plaintext: `Подтвердите почту по ссылке: ${verificationUrl}`,
          },
          subject: 'Подтверждение почты',
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

  public async sendPasswordRecoveryEmailToUser(user: IUser) {
    const key = `limit:resend_email:${user.email}_` + TokenTypesEnum.RESET_PASSWORD

    const ttl = await redis.ttl(key)

    if (ttl > 0) {
      throw new AppError(`Слишком много запросов. Попробуйте через ${ttl} секунд(ы).`, 429)
    }

    await redis.set(key, 'locked', 'EX', SEND_INTERVAL - SLACK_TIME)

    const tokenModel = await this.tokenService.generateAndSaveResetToken(user.id)

    if (!tokenModel) {
      throw new NotFoundError(ErrorMessages.TOKEN_NOT_FOUND)
    }

    const recoveryUrl = `https://kanway.com/password-recovery?token=${tokenModel.token}`
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

  public async sendPaymentSuccessEmail(
    user: IUser,
    data: {
      subscription_name: string
      amount: string
      date: string
      next_billing_date: string
    },
  ) {
    const templatePath = path.resolve('email-templates/payment-success.html')

    const htmlContent = await fs.promises.readFile(templatePath, 'utf8')

    const date = dayjs(data.date).format('DD.MM.YYYY HH:mm')
    const nextBillingDate = dayjs(data.next_billing_date).format('DD.MM.YYYY 00:00')

    const inputBody = {
      message: {
        recipients: [
          {
            email: user.email,
            substitutions: {
              subscription_name: data.subscription_name,
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
}
