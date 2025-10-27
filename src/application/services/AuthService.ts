import { IUser } from '@entities/IUser.ts'
import { RegisterCredentials } from '@dtos/RegisterCredentials.ts'
import { UserService } from '@application/services/UserService.ts'
import { EmailService } from '@infrastructure/services/EmailService.ts'
import { serialize } from 'cookie'
import { TokenService } from '@application/services/TokenService.ts'
import { LoginCredentials } from '@dtos/LoginCredentials.ts'

export class AuthService {
  private userService: UserService
  private emailService: EmailService
  private tokenService: TokenService

  constructor(userService: UserService, emailService: EmailService, tokenService: TokenService) {
    this.userService = userService
    this.emailService = emailService
    this.tokenService = tokenService
  }

  public async register(
    credentials: RegisterCredentials
  ): Promise<{ user: IUser; serialized: string }> {
    const newUser = await this.userService.create(credentials)

    await this.emailService.sendEmailToUser(newUser.email, newUser._id)

    const token = this.tokenService.generateToken(newUser._id)

    const serialized = serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    //Uncomment after create Setting model
    /*const setting = new Setting({ is_delete_instead_archive: false, user_id: user._id, model: 1 })

    setting.save()*/

    return {
      user: newUser,
      serialized,
    }
  }

  public async login(credentials: LoginCredentials): Promise<{ user: IUser; serialized: string }> {
    const user = await this.userService.validateCredentials(credentials.email, credentials.password)

    const token = this.tokenService.generateToken(user._id)

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

  public async me(id: string): Promise<IUser | null> {
    const user = await this.userService.getById(id)

    if (user) {
      return user
    }

    return null
  }
}
