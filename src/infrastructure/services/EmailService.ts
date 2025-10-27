import TokenRepository from '@repositories/TokenRepository.ts'
import nodemailer from 'nodemailer'
import { TokenService } from '@application/services/TokenService.ts'
import { NotFoundError } from '@errors/NotFound.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { Types } from 'mongoose'

const transporter = nodemailer.createTransport({
  service: 'Yandex',
  port: 465,
  secure: true,
  logger: true,
  auth: {
    user: 'owner@kanbar.ru',
    pass: '123456Saharaq1+',
  },
  tls: {
    rejectUnauthorized: true,
  },
})

export class EmailService {
  protected tokenRepository: TokenRepository
  protected tokenService: TokenService

  constructor(tokenRepository: TokenRepository, tokenService: TokenService) {
    this.tokenRepository = tokenRepository
    this.tokenService = tokenService
  }

  public async sendEmailToUser(email: string, user_id: Types.ObjectId) {
    const tokenModel = await this.tokenService.generateAndSaveConfirmationToken(user_id)

    if (!tokenModel) {
      throw new NotFoundError(ErrorsMessage.TOKEN_NOT_FOUND)
    }

    const mailOptions = {
      from: 'Kanbar <noreply@kanbar.ru>',
      to: email,
      subject: 'Подтвердите свой аккаунт на Kanbar.ru',
      html: `
        <div style="text-align: center; width: 100%; background-color: white; font-family: 'Tahoma', sans-serif; max-width: 600px">
          <img src="https://kanbar.ru/assets/favicon/logo.png" height="33" alt="Logo" title="Logo" style="display: inline-block">
          <h2 style="color: #3B3B3B; margin-top: 30px;">Приветствуем на Kanbar.ru!</h2>
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;">Остался всего один шаг, чтобы начать пользоваться возможностями Kanbar.ru. Пожалуйста, подтвердите свой адрес электронной почты, нажав на кнопку ниже:</p>
          <p style="text-align: center; margin-top: 22px; margin-bottom: 22px;">
            <a href="https://kanbar.ru/confirmation/${tokenModel.token}" style="font-size: 13px; background-color: #3B82F6; color: white; padding: 10px 14px; font-weight: 500; text-decoration: none; border-radius: 6px;">Подтвердить Email</a>
          </p>
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;">Ссылка действительна в течение 24 часов. Если вы не подтвердите свой адрес электронной почты в течение этого времени, вам нужно будет запросить новое письмо с подтверждением.</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;"><strong>Не запрашивали это письмо?</strong></p>
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;">Возможно, кто-то другой по ошибке указал ваш адрес электронной почты. Если это так, просто проигнорируйте это письмо. Ваш адрес электронной почты не будет использован для создания аккаунта.</p>
          </p>
        </div>
      `,
    }

    return transporter.sendMail(mailOptions)
  }
}
