import { Request, Response } from 'express'
import BaseController from './Base.ts'
import {
  USER_AVATAR_UPDATE_ERROR,
  USER_NOT_FOUND_ERROR,
  USER_UPDATE_ERROR,
} from '../Enums/ErrorsEnum.ts'
import User from '../Models/User.ts'
import sharp from 'sharp'
import fs from 'fs'
import { Types } from 'mongoose'
import nodemailer from 'nodemailer'
import TokenTypes from '../Enums/TokenTypes.ts'
import Token from '../Models/Token.ts'

class UserController {
  static async update(req: Request, res: Response) {
    const body = req.body

    try {
      const result = await User.updateOne(
        { _id: res.locals.user._id },
        {
          ...body,
        }
      )

      res.send(BaseController.successFunc(result))
    } catch (e: any) {
      res.send(BaseController.failedFunc(USER_UPDATE_ERROR, e))
    }
  }

  static async reduceGenerationsBalance(user_id: Types.ObjectId) {
    const user = await User.findById(user_id)

    if (user) {
      await User.updateOne({ _id: user._id }, { generations_balance: user.generations_balance - 1 })
    }
  }

  static async getUserHandler(user_id: Types.ObjectId | string) {
    const user = await User.findById(user_id)

    return user
  }

  static async getUserByPaymentMethodHandler(payment_method_id: string) {
    const user = await User.findOne({ payment_method_id })

    return user
  }

  static async sendEmailConfirmationHandler(email: string, user_id: Types.ObjectId) {
    const tokenModel = await Token.findOne({ user_id, type: TokenTypes.EMAIL_CONFIRMATION })

    if (!tokenModel) {
      throw new Error('Токен для подтверждения почты не найден')
    }

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

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(`Error: ${error}`)
      }
      console.log(`Message Sent: ${info.response}`)
    })
  }

  static async sendRecoverPasswordHandler(email: string, user_id: Types.ObjectId) {
    const tokenModel = await Token.findOne({ user_id, type: TokenTypes.RESET_PASSWORD })

    if (!tokenModel) {
      throw new Error('Токен для сброса пароля не найден')
    }

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

    const mailOptions = {
      from: 'Kanbar <noreply@kanbar.ru>',
      to: email,
      subject: 'Восстановление пароля на Kanbar.ru',
      html: `
        <div style="text-align: center; width: 100%; background-color: white; font-family: 'Tahoma', sans-serif; max-width: 600px">
          <img src="https://kanbar.ru/assets/favicon/logo.png" height="33" alt="Logo" title="Logo" style="display: inline-block">
          <h2 style="color: #3B3B3B; margin-top: 30px;">Восстановление пароля</h2>
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;">Мы получили запрос на сброс пароля для вашего аккаунта Kanbar.ru. Если вы не отправляли этот запрос, просто проигнорируйте это письмо.</p>
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;">Чтобы сбросить пароль, нажмите на кнопку ниже:</p>
          <p style="text-align: center; margin-top: 22px; margin-bottom: 22px;">
            <a href="https://kanbar.ru/password/recovery/${tokenModel.token}" style="font-size: 13px; background-color: #3B82F6; color: white; padding: 10px 14px; font-weight: 500; text-decoration: none; border-radius: 6px;">Сбросить пароль</a>
          </p>
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;">Ссылка действительна в течение 24 часов. Если вы не сбросите пароль в течение этого времени, вам нужно будет запросить новое письмо для восстановления пароля.</p>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #3B3B3B; line-height: 1.5; font-size: 15px;">Если у вас возникли вопросы, свяжитесь с нашей <a href="mailto:support@kanbar.ru">службой поддержки</a></p>
        </div>
      `,
    }

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        return console.log(`Error: ${error}`)
      }
    })
  }

  static async sendEmailConfirmation(req: Request, res: Response) {
    const user = await UserController.getUserHandler(res.locals.user._id)

    if (!user || !user.email) return BaseController.failedFunc(USER_NOT_FOUND_ERROR, null)

    try {
      const sendResult = await UserController.sendEmailConfirmationHandler(
        user.email,
        res.locals.user._id
      )

      res.send(BaseController.successFunc(sendResult))
    } catch (e: any) {
      res.send(BaseController.failedFunc(USER_UPDATE_ERROR, e))
    }
  }

  static async sendRecoverPassword(req: Request, res: Response) {
    const email = req.body.email?.toLowerCase()

    try {
      const sendResult = await UserController.sendRecoverPasswordHandler(email, res.locals.user._id)

      res.send(BaseController.successFunc(sendResult))
    } catch (e: any) {
      res.send(BaseController.failedFunc(USER_UPDATE_ERROR, e))
    }
  }

  static async uploadPhoto(req: Request, res: Response) {
    const avatar = req.file

    if (!avatar) {
      return res.send(BaseController.failedFunc(USER_AVATAR_UPDATE_ERROR))
    }

    sharp(avatar.path)
      .resize(300, 300)
      .toFormat('png')
      .toFile(`uploads/avatar_${res.locals.user._id}.png`, (err) => {
        if (err) {
          return res.send(BaseController.failedFunc(USER_AVATAR_UPDATE_ERROR, err))
        }

        fs.unlink(avatar.path, () => {})

        res.send(BaseController.successFunc('Файл аватара успешно загружен'))
      })
  }
}

export default UserController
