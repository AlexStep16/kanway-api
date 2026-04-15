import { IUserRaw } from '@entities/IUserRaw.js'
import { IUser } from '@entities/IUser.js'
import { AppError } from '@errors/AppError.js'
import bcrypt from 'bcrypt'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.js'
import { BASE_COLORS } from '@constants/BASE_COLORS.js'
import { toMongoCaseKeys, toServerCaseKeys } from '@/utils/objectTransformers.js'
import { UserEditDTO } from '@dtos/UserEditDTO.js'
import { IUserCriteria } from '@interfaces/criterias/IUserCriteria.js'
import UserRepository from '@repositories/UserRepository.js'
import { SALT_ROUNDS } from '@constants/SALT_ROUNDS.js'
import { ICreateUserService } from '@traits/ICreateUserService.js'
import { SystemFields } from '@infrastructure/types/SystemFields.js'
import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.js'

import { ClientSession, Types } from 'mongoose'
import sharp from 'sharp'
import { rm } from 'fs/promises'
import { EmailService } from '@/infrastructure/services/EmailService.js'
import { getCreditsUsed } from '@/utils/getCreditsUsed.js'

export class UserService implements ICreateUserService<IUser, RegisterCredentialsDTO> {
  private repository: UserRepository
  protected emailService: EmailService

  constructor(repository: UserRepository, emailService: EmailService) {
    this.repository = repository
    this.emailService = emailService
  }

  public async create(
    credentials: RegisterCredentialsDTO,
    session?: ClientSession,
  ): Promise<IUser[]> {
    const user: Omit<IUser, SystemFields> = {
      email: credentials.email.toLowerCase(),
      passwordHash: credentials.password,
      timezone: credentials.timezone,
      subscriptionId: SubscriptionPlanEnum.Basic,
      isConfirmed: false,
      avatarColor: BASE_COLORS[Math.floor(Math.random() * 7)],
      paymentRetriesCount: 0,
      credits: 50,
      isTipsCompleted: false,
    }

    const result = await this.repository.create(user, session)

    return [toServerCaseKeys(result)]
  }

  public async edit(
    data: UserEditDTO,
    criteria: IUserCriteria,
    user?: IUser,
    session?: ClientSession,
  ): Promise<IUser> {
    const payload = toMongoCaseKeys<IUserRaw>(data)

    if (data.password && data.currentPassword && user) {
      const oldPasswordHash = await this._comparePasswords(
        data.currentPassword,
        new Types.ObjectId(user.id),
      )

      const isOldPasswordSameAsNew = await bcrypt.compare(data.password, oldPasswordHash)

      if (isOldPasswordSameAsNew) {
        throw new AppError(ErrorMessages.PASSWORD_SAME_AS_OLD, 422)
      }
    }

    if (data.password) payload.password_hash = await bcrypt.hash(data.password, SALT_ROUNDS)

    const updateUserResult = await this.repository.updateManyByCriteria(criteria, payload, session)

    if (updateUserResult.modifiedCount === 0) {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }

    const updatedUsers = await this.repository.findByCriteria(criteria)

    return toServerCaseKeys<IUser>(updatedUsers[0])
  }

  private async _comparePasswords(oldPassword: string, userId: Types.ObjectId): Promise<string> {
    const passwordHash = await this.repository.getPasswordHashById(userId)

    if (passwordHash) {
      const isMatch = await bcrypt.compare(oldPassword, passwordHash)

      if (!isMatch) {
        throw new AppError({ oldPassword: ErrorMessages.INVALID_CURRENT_PASSWORD }, 422)
      }

      return passwordHash
    } else {
      throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)
    }
  }

  public async delete(criteria: IUserCriteria, userId?: Types.ObjectId): Promise<void> {
    await this.repository.deleteMany(criteria, userId)
  }

  public async getById(id: string): Promise<IUser | null> {
    const users = await this.repository.findByCriteria({ id })

    return toServerCaseKeys(users[0])
  }

  public async getByEmail(email: string): Promise<IUser | null> {
    const normalizedEmail = email.toLowerCase().trim()
    const users = await this.repository.findByCriteria({ email: normalizedEmail })

    return toServerCaseKeys(users[0])
  }

  public async validateCredentials(email: string, passwordPlain: string): Promise<IUser> {
    const normalizedEmail = email.toLowerCase().trim()
    const user = await this.repository.findByEmail(normalizedEmail)

    if (!user) {
      throw new AppError(ErrorMessages.INVALID_CREDENTIALS, 401)
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password_hash)

    if (!isMatch) {
      throw new AppError(ErrorMessages.INVALID_CREDENTIALS, 401)
    }

    return toServerCaseKeys(user)
  }

  public async me(id: Types.ObjectId): Promise<IUser | null> {
    const user = await this.getById(id.toString())

    if (user) {
      return user
    }

    return null
  }

  public async updateAvatar(id: Types.ObjectId, file: Express.Multer.File): Promise<string> {
    const filePath = `uploads/avatar_${id.toString()}_${Date.now()}.png`

    await sharp(file.path).resize(300, 300).toFormat('png').toFile(filePath)

    rm(file.path)

    await this.repository.updateManyByCriteria({ id: id.toString() }, { avatarUrl: filePath })

    return filePath
  }

  public async resetAvatar(id: Types.ObjectId): Promise<void> {
    await this.repository.updateManyByCriteria({ id: id.toString() }, { avatarUrl: null })
  }

  public async sendVerificationEmail(user: IUser): Promise<void> {
    if (user.isConfirmed) throw new AppError(ErrorMessages.USER_ALREADY_CONFIRMED, 409)

    await this.emailService.sendVerifyEmailToUser(user)
  }

  public async payCreditsByTokens(
    tokensUsed: number,
    userId: string,
    userCredits?: number,
  ): Promise<number> {
    let finalAmount = getCreditsUsed(tokensUsed)

    if (userCredits !== undefined && userCredits < finalAmount) finalAmount = userCredits

    await this.repository.decrementFieldByCriteria({ id: userId }, 'credits', finalAmount)

    return finalAmount
  }
}
