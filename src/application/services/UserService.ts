import { IUserRaw } from '@entities/IUserRaw.ts'
import { IUser } from '@entities/IUser.ts'
import { AppError } from '@errors/AppError.ts'
import bcrypt from 'bcrypt'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { RegisterCredentialsDTO } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'
import { toMongoCaseKeys, toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { UserEditDTO } from '@dtos/UserEditDTO.ts'
import { IUserCriteria } from '@interfaces/criterias/IUserCriteria.ts'
import UserRepository from '@repositories/UserRepository.ts'
import { SALT_ROUNDS } from '@constants/SALT_ROUNDS.ts'
import { ICreateUserService } from '@traits/ICreateUserService.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.ts'

import { ClientSession, Types } from 'mongoose'
import sharp from 'sharp'
import { rm } from 'fs/promises'

export class UserService implements ICreateUserService<IUser, RegisterCredentialsDTO> {
  private repository: UserRepository

  constructor(repository: UserRepository) {
    this.repository = repository
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
      isTipsCompleted: false,
    }

    const result = await this.repository.create(user, session)

    return [toServerCaseKeys(result)]
  }

  public async edit(data: UserEditDTO, criteria: IUserCriteria, user: IUser) {
    const payload = toMongoCaseKeys<IUserRaw>(data)

    if (data.password && data.currentPassword) {
      const oldPasswordHash = await this._comparePasswords(
        data.currentPassword,
        new Types.ObjectId(user.id),
      )

      const isOldPasswordSameAsNew = await bcrypt.compare(data.password, oldPasswordHash)

      if (isOldPasswordSameAsNew) {
        throw new AppError({ newPassword: ErrorMessages.PASSWORD_SAME_AS_OLD }, 422)
      }

      payload.password_hash = await bcrypt.hash(data.password, SALT_ROUNDS)
    }

    const updateUserResult = await this.repository.updateManyByCriteria(criteria, payload)

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

  public async validateCredentials(email: string, passwordPlain: string): Promise<IUser> {
    const user = await this.repository.findByEmail(email)

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
}
