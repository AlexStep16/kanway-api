import { IUser } from '@entities/IUser.ts'
import UserRepository from '@repositories/UserRepository.ts'
import { AppError } from '@errors/AppError.ts'
import bcrypt from 'bcrypt'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { ICreateService } from '@interfaces/traits/ICreateService.ts'
import { IGetByIdService } from '../interfaces/traits/IGetByIdService.ts'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

const SALT_ROUNDS = 10

export class UserService
  implements ICreateService<IUser, RegisterCredentialsDTO>, IGetByIdService<IUser>
{
  private userRepository: UserRepository

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository
  }

  public async create(credentials: RegisterCredentialsDTO): Promise<IUser> {
    const passwordHash = await bcrypt.hash(credentials.password, SALT_ROUNDS)

    const user: Omit<IUser, '_id'> = {
      username: '',
      email: credentials.email.toLowerCase(),
      password_hash: passwordHash,
      is_confirmed: false,
      subscription: 'trial',
      generations_balance: 20,
      avatar_color: BASE_COLORS[Math.floor(Math.random() * 7)],
      is_tips_completed: false,
    }

    const result = await this.userRepository.create(user)

    return result
  }

  public async getById(id: string): Promise<IUser | null> {
    return this.userRepository.findById(id)
  }

  public async validateCredentials(email: string, passwordPlain: string): Promise<IUser> {
    const user = await this.userRepository.findByEmail(email)

    if (!user) {
      throw new AppError(ErrorsMessage.INVALID_CREDENTIALS, 401)
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password_hash)

    if (!isMatch) {
      throw new AppError(ErrorsMessage.INVALID_CREDENTIALS, 401)
    }

    return user
  }
}
