import { IUserRaw } from '@entities/IUserRaw.ts'
import { IUser } from '@entities/IUser.ts'
import { AppError } from '@errors/AppError.ts'
import bcrypt from 'bcrypt'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { IGetByIdService } from '@interfaces/traits/IGetByIdService.ts'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'
import { toMongoCaseKeys, toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { UserEditDTO } from '@dtos/UserEditDTO.ts'
import { UserCriteria } from '@interfaces/criterias/UserCriteria.ts'
import UserRepository from '@repositories/UserRepository.ts'
import { SALT_ROUNDS } from '@constants/SALT_ROUNDS.ts'
import { ICreateUserService } from '@traits/ICreateUserService.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import SubscriptionRepository from '@repositories/SubscriptionRepository.ts'
import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.ts'

import { ClientSession, Types } from 'mongoose'
import sharp from 'sharp'
import { rm } from 'fs/promises'

export class UserService
  implements ICreateUserService<IUser, RegisterCredentialsDTO>, IGetByIdService<IUser>
{
  private repository: UserRepository
  private subscriptionRepository: SubscriptionRepository

  constructor(repository: UserRepository, subscriptionRepository: SubscriptionRepository) {
    this.repository = repository
    this.subscriptionRepository = subscriptionRepository
  }

  public async create(
    credentials: RegisterCredentialsDTO,
    session?: ClientSession
  ): Promise<IUser[]> {
    const subscription = await this.subscriptionRepository.findByCustomId(
      SubscriptionPlanEnum.Basic
    )

    if (!subscription) throw new AppError(ErrorsMessage.SUBSCRIPTION_PLAN_NOT_FOUND, 404)

    const user: Omit<IUserRaw, SystemFields> = {
      email: credentials.email.toLowerCase(),
      password_hash: credentials.password,
      timezone: credentials.timezone,
      subscription_id: subscription._id,
      is_confirmed: false,
      avatar_color: BASE_COLORS[Math.floor(Math.random() * 7)],
      is_tips_completed: false,
    }

    const result = await this.repository.create(user, session)

    return [toServerCaseKeys(result)]
  }

  public async edit(data: UserEditDTO, criteria: UserCriteria, user: IUser) {
    const filter = this.repository.buildFilter(criteria)
    const payload = toMongoCaseKeys<IUserRaw>(data)

    if (data.password && data.oldPassword) {
      const oldPasswordHash = await this._comparePasswords(
        data.oldPassword,
        new Types.ObjectId(user.id)
      )

      const isOldPasswordSameAsNew = await bcrypt.compare(data.password, oldPasswordHash)

      if (isOldPasswordSameAsNew) {
        throw new AppError({ newPassword: ErrorsMessage.PASSWORD_SAME_AS_OLD }, 422)
      }

      payload.password_hash = await bcrypt.hash(data.password, SALT_ROUNDS)
    }

    const updatedUser = await this.repository.updateByFilter(filter, payload)

    return toServerCaseKeys<IUser>(updatedUser[0])
  }

  private async _comparePasswords(oldPassword: string, userId: Types.ObjectId): Promise<string> {
    const passwordHash = await this.repository.getPasswordHashById(userId)

    if (passwordHash) {
      const isMatch = await bcrypt.compare(oldPassword, passwordHash)

      if (!isMatch) {
        throw new AppError({ oldPassword: ErrorsMessage.INVALID_CURRENT_PASSWORD }, 422)
      }

      return passwordHash
    } else {
      throw new AppError(ErrorsMessage.USER_NOT_FOUND, 404)
    }
  }

  public async delete(criteria: UserCriteria): Promise<void> {
    const filter = this.repository.buildFilter(criteria)

    await this.repository.deleteMany(filter)
  }

  public async getById(id: string): Promise<IUser | null> {
    const user = await this.repository.findById(id)

    return toServerCaseKeys(user)
  }

  public async validateCredentials(email: string, passwordPlain: string): Promise<IUser> {
    const user = await this.repository.findByEmail(email)

    if (!user) {
      throw new AppError(ErrorsMessage.INVALID_CREDENTIALS, 401)
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password_hash)

    if (!isMatch) {
      throw new AppError(ErrorsMessage.INVALID_CREDENTIALS, 401)
    }

    return toServerCaseKeys(user)
  }

  public async me(id: Types.ObjectId): Promise<IUser | null> {
    const user = await this.getById(id.toHexString())

    if (user) {
      return user
    }

    return null
  }

  public async updateAvatar(id: Types.ObjectId, file: Express.Multer.File): Promise<string> {
    const filePath = `uploads/avatar_${id.toHexString()}_${Date.now()}.png`

    await sharp(file.path).resize(300, 300).toFormat('png').toFile(filePath)

    rm(file.path)

    const filter = this.repository.buildFilter({ id: id.toHexString() })

    await this.repository.updateByFilter(filter, { avatar_url: filePath })

    return filePath
  }
}
