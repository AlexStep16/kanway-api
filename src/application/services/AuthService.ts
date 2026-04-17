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

  public async register(
    credentials: RegisterCredentialsDTO,
  ): Promise<{ user: IUser; serialized: string }> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const newUser = await this.userService.create(credentials, session)

      await this.emailService.sendVerifyEmailToUser(newUser[0])

      const token = this.tokenService.generateToken(newUser[0].id, 60 * 60 * 24 * 30)

      const serialized = serialize('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })

      await this.settingService.create(
        {
          aiName: 'Kanway',
          aiConfirmationType: AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE,
        },
        newUser[0].id,
        session,
      )

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

  public async checkEmailUnique(email: string): Promise<boolean> {
    const user = await this.userService.getByEmail(email)

    return !user
  }

  public async login(
    credentials: LoginCredentialsDTO,
  ): Promise<{ user: IUser; serialized: string }> {
    const user = await this.userService.validateCredentials(credentials.email, credentials.password)

    const token = this.tokenService.generateToken(user.id, 60 * 60 * 24 * 30)

    const serialized = serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

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

  public async sendResetPasswordEmailByToken(token: string): Promise<void> {
    const tokenModel = await this.tokenService.getToken(token, TokenTypesEnum.RESET_PASSWORD)

    if (!tokenModel) throw new AppError(ErrorMessages.TOKEN_NOT_FOUND, 404)

    const user = await this.userService.getById(tokenModel.userId!.toString())

    if (!user) throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)

    await this.emailService.sendPasswordRecoveryEmailToUser(user)
  }

  public async confirmEmail(token: string): Promise<IUser> {
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
