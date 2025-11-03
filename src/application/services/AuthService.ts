import { IUser } from '@entities/IUser.ts'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { UserService } from '@application/services/UserService.ts'
import { EmailService } from '@infrastructure/services/EmailService.ts'
import { serialize } from 'cookie'
import { TokenService } from '@application/services/TokenService.ts'
import { LoginCredentialsDTO } from '@/application/dtos/LoginCredentialsDTO.ts'
import { Types } from 'mongoose'

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
    credentials: RegisterCredentialsDTO
  ): Promise<{ user: IUser; serialized: string }> {
    const newUser = await this.userService.create(credentials)

    await this.emailService.sendEmailToUser(newUser[0].email, newUser[0].id)

    const token = this.tokenService.generateToken(newUser[0].id)

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
      user: newUser[0],
      serialized,
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

  public async me(id: Types.ObjectId): Promise<IUser | null> {
    const user = await this.userService.getById(id.toHexString())

    if (user) {
      return user
    }

    return null
  }
}
