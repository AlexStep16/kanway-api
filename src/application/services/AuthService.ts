import { IUser } from '@entities/IUser.ts'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { UserService } from '@application/services/UserService.ts'
import { EmailService } from '@infrastructure/services/EmailService.ts'
import { serialize } from 'cookie'
import { TokenService } from '@application/services/TokenService.ts'
import { LoginCredentialsDTO } from '@/application/dtos/LoginCredentialsDTO.ts'
import mongoose from 'mongoose'
import { SettingService } from '@application/services/SettingService.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'

export class AuthService {
  private userService: UserService
  private emailService: EmailService
  private tokenService: TokenService
  private settingService: SettingService

  constructor(
    userService: UserService,
    emailService: EmailService,
    tokenService: TokenService,
    settingService: SettingService
  ) {
    this.userService = userService
    this.emailService = emailService
    this.tokenService = tokenService
    this.settingService = settingService
  }

  public async register(
    credentials: RegisterCredentialsDTO
  ): Promise<{ user: IUser; serialized: string }> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const newUser = await this.userService.create(credentials, session)

      //await this.emailService.sendEmailToUser(newUser[0].email, newUser[0].id)

      const token = this.tokenService.generateToken(newUser[0].id)

      const serialized = serialize('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })

      await this.settingService.create(
        {
          aiName: 'Kanbar',
          aiConfirmationType: AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE,
        },
        newUser[0].id,
        session
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

  public async login(
    credentials: LoginCredentialsDTO
  ): Promise<{ user: IUser; serialized: string }> {
    const user = await this.userService.validateCredentials(credentials.email, credentials.password)

    const token = this.tokenService.generateToken(user.id)

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
}
