import TokenRepository from '@repositories/TokenRepository.ts'
import { TokenService } from '@application/services/TokenService.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import path from 'path'
import * as Sentry from '@sentry/node'
import * as fs from 'node:fs'
import { IUser } from '@/domain/entities/IUser.ts'
import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.ts'
import { Redis } from 'ioredis'
import { AppError } from '@/domain/errors/AppError.ts'

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

    const verificationUrl = `https://kanbar.com/verify?token=${tokenModel.token}`

    try {
      const templatePath = path.resolve('email-templates/verify-email.html')

      let htmlContent = await fs.promises.readFile(templatePath, 'utf8')

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
          from_email: 'noreply@kanbar.ru',
          from_name: 'Kanbar',
          track_links: 0,
          track_read: 0,
        },
      }

      await fetch('https://go2.unisender.ru/ru/transactional/api/v1/email/send.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-KEY': process.env.UNISENDER_API_KEY || '',
        },
        body: JSON.stringify(inputBody),
      })
    } catch (err: unknown) {
      await redis.del(key)
      if (err instanceof AppError && err.statusCode !== 429) Sentry.captureException(err)
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

    const recoveryUrl = `https://kanbar.com/password-recovery?token=${tokenModel.token}`
    try {
      const templatePath = path.resolve('email-templates/password-recovery.html')

      let htmlContent = await fs.promises.readFile(templatePath, 'utf8')

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
          from_email: 'noreply@kanbar.ru',
          from_name: 'Kanbar',
          track_links: 0,
          track_read: 0,
        },
      }

      await fetch('https://go2.unisender.ru/ru/transactional/api/v1/email/send.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-API-KEY': process.env.UNISENDER_API_KEY || '',
        },
        body: JSON.stringify(inputBody),
      })
    } catch (err: unknown) {
      await redis.del(key)
      if (err instanceof AppError && err.statusCode !== 429) Sentry.captureException(err)
    }
  }
}
