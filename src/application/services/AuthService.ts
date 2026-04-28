import { IUser } from '@entities/IUser.js'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.js'
import { UserService } from '@application/services/UserService.js'
import { EmailService } from '@infrastructure/services/EmailService.js'
import { serialize } from 'cookie'
import { TokenService } from '@application/services/TokenService.js'
import { LoginCredentialsDTO } from '@/application/dtos/LoginCredentialsDTO.js'
import mongoose from 'mongoose'
import { SettingService } from '@application/services/SettingService.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { TokenTypesEnum } from '@/domain/enums/TokenTypesEnum.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { AppError } from '@/domain/errors/AppError.js'
import { YandexAuthDTO } from '../dtos/YandexAuthDTO.js'
import { YandexUser } from '../interfaces/YandexUser.js'
import { VkAuthDTO } from '../dtos/VkAuthDTO.js'
import { VkUser } from '../interfaces/VkUser.js'

export class AuthService {
  private userService: UserService
  private emailService: EmailService
  private tokenService: TokenService
  private settingService: SettingService

  constructor(
    userService: UserService,
    emailService: EmailService,
    tokenService: TokenService,
    settingService: SettingService,
  ) {
    this.userService = userService
    this.emailService = emailService
    this.tokenService = tokenService
    this.settingService = settingService
  }

  private _getTokenSerialized(token: string) {
    return serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }

  public async initNewUser(
    newUser: IUser,
    session?: mongoose.ClientSession,
    confirmationNeeded = true,
  ): Promise<string> {
    if (confirmationNeeded) {
      //await this.emailService.sendVerifyEmailToUser(newUser)
    }

    const token = this.tokenService.generateToken(newUser.id, 60 * 60 * 24 * 30)

    const serialized = this._getTokenSerialized(token)

    await this.settingService.create(
      {
        aiName: 'Kanway',
        aiConfirmationType: AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE,
      },
      newUser.id,
      session,
    )

    return serialized
  }

  public async register(
    credentials: RegisterCredentialsDTO,
  ): Promise<{ user: IUser; serialized: string }> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const newUser = await this.userService.create(credentials, session)

      const serialized = await this.initNewUser(newUser[0], session)

      await session.commitTransaction()

      return {
        user: newUser[0],
        serialized,
      }
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }

  public async yandex(payload: YandexAuthDTO) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const accessTokenResponse = await fetch('https://oauth.yandex.ru/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: payload.code,
          code_verifier: payload.codeVerifier,
          client_id: process.env.YANDEX_CLIENT_ID,
          device_id: payload.deviceId,
          redirect_uri: 'https://kanway.ru/yandex/suggest/token',
        }),
      })

      const accessTokenData = await accessTokenResponse.json()

      if (!accessTokenData.access_token) {
        throw new AppError(ErrorMessages.YANDEX_AUTH_FAILED, 400)
      }

      const userInfoResponse = await fetch('https://login.yandex.ru/info?format=json', {
        headers: {
          Authorization: `OAuth ${accessTokenData.access_token}`,
        },
      })
      const userInfo = (await userInfoResponse.json()) as YandexUser

      const user = await this.userService.getByEmail(userInfo.default_email)

      if (!user) {
        const newUser = await this.userService.createYandexUser({
          username: userInfo.display_name,
          email: userInfo.default_email,
          clientId: userInfo.client_id,
          timezone: payload.timezone,
        })

        const serialized = await this.initNewUser(newUser[0], session, false)

        await session.commitTransaction()

        return {
          user: newUser[0],
          serialized,
        }
      } else {
        if (!user.yandexClientId) {
          await this.userService.edit(
            { yandexClientId: userInfo.client_id },
            { id: user.id.toString() },
            undefined,
            session,
          )
        }

        const token = this.tokenService.generateToken(user.id, 60 * 60 * 24 * 30)

        const serialized = this._getTokenSerialized(token)

        await session.commitTransaction()

        return {
          user,
          serialized,
        }
      }
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }

  public async vk(payload: VkAuthDTO) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const accessTokenResponse = await fetch('https://id.vk.ru/oauth2/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: payload.code,
          code_verifier: payload.codeVerifier,
          client_id: process.env.VK_CLIENT_ID,
          device_id: payload.deviceId,
          redirect_uri: 'https://kanway.ru/vk/suggest/token',
        }),
      })

      const accessTokenData = await accessTokenResponse.json()

      if (!accessTokenData.access_token) {
        throw new AppError(ErrorMessages.VK_AUTH_FAILED, 400)
      }

      const userInfoResponse = await fetch('https://id.vk.ru/oauth2/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: JSON.stringify({
          client_id: process.env.VK_CLIENT_ID,
          id_token: accessTokenData.access_token,
        }),
      })
      const userInfo = (await userInfoResponse.json()) as VkUser

      const user = await this.userService.getByEmail(userInfo.email)

      if (!user) {
        const newUser = await this.userService.createVkUser({
          username: userInfo.first_name + ' ' + userInfo.last_name,
          email: userInfo.email,
          clientId: userInfo.user_id,
          timezone: payload.timezone,
        })

        const serialized = await this.initNewUser(newUser[0], session, false)

        await session.commitTransaction()

        return {
          user: newUser[0],
          serialized,
        }
      } else {
        if (!user.vkClientId) {
          await this.userService.edit(
            { vkClientId: userInfo.user_id },
            { id: user.id.toString() },
            undefined,
            session,
          )
        }

        const token = this.tokenService.generateToken(user.id, 60 * 60 * 24 * 30)

        const serialized = this._getTokenSerialized(token)

        await session.commitTransaction()

        return {
          user,
          serialized,
        }
      }
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }

  public async checkEmailUnique(email: string): Promise<boolean> {
    const user = await this.userService.getByEmail(email)

    return !user
  }

  public async login(
    credentials: LoginCredentialsDTO,
  ): Promise<{ user: IUser; serialized: string }> {
    const user = await this.userService.validateCredentials(credentials.email, credentials.password)

    const token = this.tokenService.generateToken(user.id, 60 * 60 * 24 * 30)

    const serialized = this._getTokenSerialized(token)

    return {
      user,
      serialized,
    }
  }

  public async verifyOTPLogin(
    code: string,
    email: string,
  ): Promise<{ user: IUser; serialized: string }> {
    const user = await this.userService.verifyOTPLogin(code, email)

    const token = this.tokenService.generateToken(user.id, 60 * 60 * 24 * 30)

    const serialized = this._getTokenSerialized(token)

    return {
      user,
      serialized,
    }
  }

  public async changeUserPassword(
    token: string,
    password: string,
  ): Promise<{ user: IUser; serialized: string }> {
    const userToken = await this.tokenService.getToken(token, TokenTypesEnum.RESET_PASSWORD)

    if (!userToken) throw new AppError(ErrorMessages.TOKEN_NOT_FOUND, 404)
    if (userToken.isActive === false) throw new AppError(ErrorMessages.TOKEN_EXPIRED, 410)

    const updatedUser = await this.userService.edit(
      { password },
      { id: userToken.userId.toHexString() },
    )

    await this.tokenService.edit({ isActive: false }, token, userToken.userId)

    return await this.login({
      email: updatedUser.email,
      password,
    })
  }

  public async sendResetPasswordEmail(email: string): Promise<void> {
    const user = await this.userService.getByEmail(email)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    await this.emailService.sendPasswordRecoveryEmailToUser(user)
  }

  public async sendVerificationEmailByToken(token: string): Promise<void> {
    const tokenModel = await this.tokenService.getToken(token, TokenTypesEnum.EMAIL_CONFIRMATION)

    if (!tokenModel) throw new AppError(ErrorMessages.TOKEN_NOT_FOUND, 404)

    const user = await this.userService.getById(tokenModel.userId!.toString())

    if (!user) throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)

    if (user.isConfirmed) throw new AppError(ErrorMessages.USER_ALREADY_CONFIRMED, 409)

    await this.emailService.sendVerifyEmailToUser(user)
  }

  public async sendMagicLink(token: string): Promise<void> {
    const tokenModel = await this.tokenService.getToken(token, TokenTypesEnum.EMAIL_CONFIRMATION)

    if (!tokenModel) throw new AppError(ErrorMessages.TOKEN_NOT_FOUND, 404)

    const user = await this.userService.getById(tokenModel.userId!.toString())

    if (!user) throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)

    if (user.isConfirmed) throw new AppError(ErrorMessages.USER_ALREADY_CONFIRMED, 409)

    await this.emailService.sendVerifyEmailToUser(user)
  }

  public async sendResetPasswordEmailByToken(token: string): Promise<void> {
    const tokenModel = await this.tokenService.getToken(token, TokenTypesEnum.RESET_PASSWORD)

    if (!tokenModel) throw new AppError(ErrorMessages.TOKEN_NOT_FOUND, 404)

    const user = await this.userService.getById(tokenModel.userId!.toString())

    if (!user) throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)

    await this.emailService.sendPasswordRecoveryEmailToUser(user)
  }

  public async verifyToken(token: string): Promise<IUser> {
    const tokenModel = await this.tokenService.getToken(token, TokenTypesEnum.EMAIL_CONFIRMATION)

    if (!tokenModel) throw new AppError(ErrorMessages.TOKEN_NOT_FOUND, 404)
    if (tokenModel.isActive === false) throw new AppError(ErrorMessages.TOKEN_EXPIRED, 410)

    const user = await this.userService.getById(tokenModel.userId.toString())

    if (!user) throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    if (user.isConfirmed) throw new AppError(ErrorMessages.USER_ALREADY_CONFIRMED, 409)

    await this.userService.edit({ isConfirmed: true }, { id: tokenModel.userId.toString() })

    return user
  }

  public async validateToken(token: string, type: TokenTypesEnum): Promise<void> {
    const tokenModel = await this.tokenService.getToken(token, type)

    if (!tokenModel) throw new AppError(ErrorMessages.TOKEN_NOT_FOUND, 404)
    if (tokenModel.isActive === false) throw new AppError(ErrorMessages.TOKEN_EXPIRED, 410)
  }
}
