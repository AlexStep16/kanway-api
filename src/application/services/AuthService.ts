import { IUser } from '@entities/IUser.js'
import { SignupCredentialsDTO } from '@/application/dtos/SignupCredentialsDTO.js'
import { UserService } from '@application/services/UserService.js'
import { EmailService } from '@infrastructure/services/EmailService.js'
import { serialize } from 'cookie'
import { TokenService } from '@application/services/TokenService.js'
import mongoose from 'mongoose'
import { SettingService } from '@application/services/SettingService.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { AppError } from '@/domain/errors/AppError.js'
import { YandexAuthDTO } from '../dtos/YandexAuthDTO.js'
import { YandexUser } from '../interfaces/YandexUser.js'
import { VkAuthDTO } from '../dtos/VkAuthDTO.js'
import { VkUser } from '../interfaces/VkUser.js'
import { ProvidersEnum } from '@/domain/enums/ProvidersEnum.js'
import { FinishSignupCredentialsDTO } from '../dtos/FinishSignupCredentialsDTO.js'
import { ProviderDTO } from '../dtos/ProviderDTO.js'
import { SignupServiceCredentialsDTO } from '../dtos/SignupServiceCredentialsDTO.js'
import { SigninCredentialsDTO } from '../dtos/SigninCredentialsDTO.js'
import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import { MAX_AUTH_TOKEN_AGE } from '@/constants/MAX_AUTH_TOKEN_AGE.js'

export class AuthService {
  private userService: UserService
  private emailService: EmailService
  private tokenService: TokenService
  private settingService: SettingService
  private zxcvbn: ZxcvbnFactory

  constructor(
    userService: UserService,
    emailService: EmailService,
    tokenService: TokenService,
    settingService: SettingService,
    zxcvbn: ZxcvbnFactory,
  ) {
    this.userService = userService
    this.emailService = emailService
    this.tokenService = tokenService
    this.settingService = settingService
    this.zxcvbn = zxcvbn
  }

  private _getTokenSerialized(
    token: string,
    name: string = 'token',
    maxAge: number = MAX_AUTH_TOKEN_AGE,
  ): string {
    return serialize(name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    })
  }

  public async initNewUser(
    newUser: IUser,
    session?: mongoose.ClientSession,
    confirmationNeeded = true,
  ): Promise<string> {
    if (confirmationNeeded) {
      await this.emailService.sendVerifyEmailToUser(newUser)
    }

    const token = this._getUserIdToken(newUser.id.toString())

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

  private getIsLoggedInSerialized(): string {
    return serialize('is_logged_in', 'true', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: MAX_AUTH_TOKEN_AGE,
      path: '/',
    })
  }

  private getHasFinishSignUpSerialized(): string {
    return serialize('has_finish_signup', 'true', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: MAX_AUTH_TOKEN_AGE,
      path: '/',
    })
  }

  public async register(
    credentials: SignupCredentialsDTO,
  ): Promise<{ user: IUser; serialized: string; serialized2: string }> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const newUser = await this.userService.createWithCredentials(credentials, session)

      const serialized = await this.initNewUser(newUser[0], session)
      const serialized2 = this.getIsLoggedInSerialized()

      await session.commitTransaction()

      return {
        user: newUser[0],
        serialized,
        serialized2,
      }
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }

  public async login(
    credentials: SigninCredentialsDTO,
  ): Promise<{ user: IUser; serialized: string; serialized2: string }> {
    const user = await this.userService.validateCredentials(credentials.email, credentials.password)

    const token = this._getUserIdToken(user.id.toString())

    const serialized = this._getTokenSerialized(token)
    const serialized2 = this.getIsLoggedInSerialized()

    return {
      user,
      serialized,
      serialized2,
    }
  }

  public async yandex(payload: YandexAuthDTO) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const params = new URLSearchParams()
      params.append('grant_type', 'authorization_code')
      params.append('code', payload.code)
      params.append('client_id', process.env.YANDEX_CLIENT_ID || '')
      params.append('client_secret', process.env.YANDEX_CLIENT_SECRET || '')
      if (payload.codeVerifier) params.append('code_verifier', payload.codeVerifier)
      if (payload.deviceId) params.append('device_id', payload.deviceId)
      params.append('redirect_uri', 'https://kanway.ru/yandex/suggest/token')

      const accessTokenResponse = await fetch('https://oauth.yandex.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
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

      const linkedUser = await this.userService.getByYandexUserId(userInfo.id)

      if (linkedUser) {
        const token = this._getUserIdToken(linkedUser.id.toString())
        const serialized = this._getTokenSerialized(token)
        const serialized2 = this.getIsLoggedInSerialized()

        await session.commitTransaction()

        return {
          user: linkedUser,
          serialized,
          serialized2,
        }
      }

      const userByEmail = await this.userService.getByEmail(userInfo.default_email)

      if (!userByEmail) {
        const avatarUrl = userInfo.is_avatar_empty
          ? undefined
          : `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-68`

        const newUser = await this.userService.createYandexUser({
          username: userInfo.display_name,
          email: userInfo.default_email,
          avatarUrl,
          clientId: userInfo.id,
          timezone: payload.timezone,
        })

        const serialized = await this.initNewUser(newUser[0], session, false)
        const serialized2 = this.getIsLoggedInSerialized()

        await session.commitTransaction()

        return {
          user: newUser[0],
          serialized,
          serialized2,
        }
      } else {
        if (!userByEmail.yandexUserId) {
          await this.userService.edit({ yandexUserId: userInfo.id }, userByEmail, session)
        }

        const token = this._getUserIdToken(userByEmail.id.toString())
        const serialized = this._getTokenSerialized(token)
        const serialized2 = this.getIsLoggedInSerialized()

        await session.commitTransaction()

        return {
          user: userByEmail,
          serialized,
          serialized2,
        }
      }
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }

  public async linkYandexAccount(userId: string, payload: YandexAuthDTO): Promise<IUser> {
    const params = new URLSearchParams()
    params.append('grant_type', 'authorization_code')
    params.append('code', payload.code)
    params.append('client_id', process.env.YANDEX_CLIENT_ID || '')
    params.append('client_secret', process.env.YANDEX_CLIENT_SECRET || '')
    params.append('code_verifier', payload.codeVerifier)
    params.append('redirect_uri', 'https://kanway.ru/yandex/suggest/token')

    const user = await this.userService.getById(userId)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    const accessTokenResponse = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const accessTokenData = await accessTokenResponse.json()

    if (!accessTokenData.access_token) {
      throw new AppError(ErrorMessages.YANDEX_AUTH_FAILED, 400)
    }

    const userInfoResponse = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessTokenData.access_token}` },
    })
    const userInfo = (await userInfoResponse.json()) as YandexUser

    const linkedUser = await this.userService.getByYandexUserId(userInfo.id)
    const userWithSameEmail = await this.userService.getByEmail(userInfo.default_email)

    if (linkedUser && linkedUser.id.toString() !== userId) {
      throw new AppError(ErrorMessages.YANDEX_ACCOUNT_ALREADY_LINKED, 409)
    }

    if (userWithSameEmail && userWithSameEmail.id.toString() !== userId) {
      throw new AppError(ErrorMessages.YANDEX_EMAIL_ALREADY_LINKED, 409)
    }

    return await this.userService.edit({ yandexUserId: userInfo.id }, user)
  }

  public async vk(payload: VkAuthDTO) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const params = new URLSearchParams()
      params.append('grant_type', 'authorization_code')
      params.append('code', payload.code)
      params.append('client_id', process.env.VK_CLIENT_ID || '')
      params.append('client_secret', process.env.VK_CLIENT_SECRET || '')
      if (payload.codeVerifier) params.append('code_verifier', payload.codeVerifier)
      if (payload.deviceId) params.append('device_id', payload.deviceId)
      params.append('redirect_uri', 'https://kanway.ru/vk/suggest/token')

      const accessTokenResponse = await fetch('https://id.vk.ru/oauth2/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      const accessTokenData = await accessTokenResponse.json()

      if (!accessTokenData.id_token) {
        throw new AppError(ErrorMessages.VK_AUTH_FAILED, 400)
      }

      const paramsUserInfo = new URLSearchParams()
      paramsUserInfo.append('client_id', process.env.VK_CLIENT_ID || '')
      paramsUserInfo.append('access_token', accessTokenData.access_token || '')

      const userInfoResponse = await fetch('https://id.vk.ru/oauth2/user_info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: paramsUserInfo.toString(),
      })
      const userInfo = (await userInfoResponse.json()) as VkUser
      const user = userInfo.user.user_id
        ? await this.userService.getByVkUserId(userInfo.user.user_id)
        : null

      if (!user) {
        const userByEmail = userInfo.user.email
          ? await this.userService.getByEmail(userInfo.user.email)
          : null

        if (userByEmail) {
          const user = userByEmail

          if (!user.vkUserId) {
            await this.userService.edit({ vkUserId: userInfo.user.user_id }, user, session)
          }

          const token = this._getUserIdToken(user.id.toString())
          const serialized = this._getTokenSerialized(token)
          const serialized2 = this.getIsLoggedInSerialized()

          await session.commitTransaction()

          return {
            user,
            serialized,
            serialized2,
          }
        } else {
          if (userInfo.user.email) {
            const newUser = await this.userService.createVkUser({
              username: userInfo.user.first_name + ' ' + userInfo.user.last_name,
              avatarUrl: userInfo.user.avatar,
              email: userInfo.user.email,
              clientId: userInfo.user.user_id,
              timezone: payload.timezone,
            })

            const serialized = await this.initNewUser(newUser[0], session, false)
            const serialized2 = this.getIsLoggedInSerialized()

            await session.commitTransaction()

            return {
              user: newUser[0],
              serialized,
              serialized2,
            }
          } else {
            const registrationData: ProviderDTO = {
              provider: ProvidersEnum.VK,
              clientId: userInfo.user.user_id,
              avatarUrl: userInfo.user.avatar,
              username: `${userInfo.user.first_name} ${userInfo.user.last_name}`,
            }

            const token = this.tokenService.generateToken(
              registrationData as Record<string, any>,
              60 * 15,
            )
            const serialized = this._getTokenSerialized(token, 'finish_sign_up_token', 60 * 15)
            const serialized2 = this.getHasFinishSignUpSerialized()

            return {
              serialized,
              serialized2,
            }
          }
        }
      } else {
        const token = this._getUserIdToken(user.id.toString())
        const serialized = this._getTokenSerialized(token)
        const serialized2 = this.getIsLoggedInSerialized()

        await session.commitTransaction()

        return {
          user,
          serialized,
          serialized2,
        }
      }
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }

  public async linkVkAccount(userId: string, payload: VkAuthDTO): Promise<IUser> {
    const params = new URLSearchParams()
    params.append('grant_type', 'authorization_code')
    params.append('code', payload.code)
    params.append('client_id', process.env.VK_CLIENT_ID || '')
    params.append('client_secret', process.env.VK_CLIENT_SECRET || '')
    params.append('code_verifier', payload.codeVerifier)
    if (payload.deviceId) params.append('device_id', payload.deviceId)
    params.append('redirect_uri', 'https://kanway.ru/vk/suggest/token')

    const user = await this.userService.getById(userId)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    const accessTokenResponse = await fetch('https://id.vk.ru/oauth2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const accessTokenData = await accessTokenResponse.json()

    if (!accessTokenData.id_token) {
      throw new AppError(ErrorMessages.VK_AUTH_FAILED, 400)
    }

    const paramsUserInfo = new URLSearchParams()
    paramsUserInfo.append('client_id', process.env.VK_CLIENT_ID || '')
    paramsUserInfo.append('access_token', accessTokenData.access_token || '')
    const userInfoResponse = await fetch('https://id.vk.ru/oauth2/user_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: paramsUserInfo.toString(),
    })
    const userInfo = (await userInfoResponse.json()) as VkUser
    const linkedUser = await this.userService.getByVkUserId(userInfo.user.user_id)
    const userWithSameEmail = userInfo.user.email
      ? await this.userService.getByEmail(userInfo.user.email)
      : null

    if (linkedUser && linkedUser.id.toString() !== userId) {
      throw new AppError(ErrorMessages.VK_ACCOUNT_ALREADY_LINKED, 409)
    }

    if (userWithSameEmail && userWithSameEmail.id.toString() !== userId) {
      throw new AppError(ErrorMessages.VK_EMAIL_ALREADY_LINKED, 409)
    }

    return await this.userService.edit({ vkUserId: userInfo.user.user_id }, user)
  }

  public async finishSignup(
    data: FinishSignupCredentialsDTO & ProviderDTO,
  ): Promise<{ user: IUser; serialized: string; serialized2: string }> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const user = await this.userService.getByEmail(data.email)

      if (user) {
        throw new AppError(ErrorMessages.EMAIL_ALREADY_EXISTS, 400)
      }

      const userData: SignupServiceCredentialsDTO = {
        email: data.email.toLowerCase(),
        username: data.username,
        avatarUrl: data.avatarUrl,
        timezone: data.timezone,
      }

      if (data.provider === ProvidersEnum.VK) {
        userData.vkUserId = data.clientId
      }

      const newUser = await this.userService.createWithCredentials(userData, session)
      const serialized = await this.initNewUser(newUser[0], session, true)
      const serialized2 = this.getIsLoggedInSerialized()

      await session.commitTransaction()

      return {
        user: newUser[0],
        serialized,
        serialized2,
      }
    } catch (error) {
      await session.abortTransaction()

      throw error
    } finally {
      session.endSession()
    }
  }

  public checkPasswordStrength(password: string): {
    score: number
    feedback: { warning: string; suggestions: string[] }
  } {
    const result = this.zxcvbn.check(password)
    return {
      score: result.score,
      feedback: {
        warning: result.feedback.warning ?? '',
        suggestions: result.feedback.suggestions ?? [],
      },
    }
  }

  public async checkEmailUnique(email: string): Promise<boolean> {
    if (!email) return true

    const user = await this.userService.getByEmail(email)

    return !user
  }

  private _getUserIdToken(userId: string): string {
    return this.tokenService.generateToken({ user_id: userId }, MAX_AUTH_TOKEN_AGE)
  }

  public async verifyOTPEmail(code: string, email: string) {
    const userId = await this.userService.verifyOTPEmail(code, email)

    const token = this._getUserIdToken(userId)
    const serialized = this._getTokenSerialized(token)
    const serialized2 = this.getIsLoggedInSerialized()

    return {
      serialized,
      serialized2,
    }
  }

  public async verifyOTPLogin(code: string, email: string) {
    const userId = await this.userService.verifyOTPLogin(code, email)

    const token = this._getUserIdToken(userId)
    const serialized = this._getTokenSerialized(token)
    const serialized2 = this.getIsLoggedInSerialized()

    return {
      serialized,
      serialized2,
    }
  }

  public async verifyOTPPassword(code: string, email: string) {
    const userId = await this.userService.verifyOTPPassword(code, email)

    const token = this._getUserIdToken(userId)
    const serialized = this._getTokenSerialized(token, 'reset_token', 60 * 15)

    return {
      serialized,
    }
  }

  public async changeUserPassword(userId: string, password: string) {
    const user = await this.userService.getById(userId)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    const updatedUser = await this.userService.edit({ password }, user)

    const jwtToken = this._getUserIdToken(userId)
    const serialized = this._getTokenSerialized(jwtToken)
    const serialized2 = this.getIsLoggedInSerialized()

    return {
      user: updatedUser,
      serialized,
      serialized2,
    }
  }

  public async sendVerificationEmail(email: string): Promise<void> {
    const user = await this.userService.getByEmail(email)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    await this.emailService.sendVerifyEmailToUser(user)
  }

  public async sendResetPasswordEmail(email: string): Promise<void> {
    const user = await this.userService.getByEmail(email)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    await this.emailService.sendPasswordRecoveryEmailToUser(user)
  }

  public async sendMagicLink(email: string): Promise<void> {
    const user = await this.userService.getByEmail(email)

    if (!user) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    await this.emailService.sendMagicLink(user)
  }

  public async verifyLinkEmail(token: string) {
    const userId = await this.userService.verifyLinkEmail(token)

    const jwtToken = this._getUserIdToken(userId)
    const serialized = this._getTokenSerialized(jwtToken)
    const serialized2 = this.getIsLoggedInSerialized()

    return {
      serialized,
      serialized2,
    }
  }

  public async verifyLinkLogin(token: string) {
    const userId = await this.userService.verifyLinkLogin(token)

    const jwtToken = this._getUserIdToken(userId)
    const serialized = this._getTokenSerialized(jwtToken)
    const serialized2 = this.getIsLoggedInSerialized()

    return {
      serialized,
      serialized2,
    }
  }

  public async verifyLinkPassword(token: string): Promise<{
    serialized: string
  }> {
    const userId = await this.userService.verifyLinkPassword(token)

    const resetToken = this._getUserIdToken(userId)
    const serialized = this._getTokenSerialized(resetToken, 'reset_token', 60 * 15)

    return {
      serialized,
    }
  }
}
