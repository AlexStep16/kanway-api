import { IUserRaw } from '@entities/IUserRaw.js'
import { IUser } from '@entities/IUser.js'
import { AppError } from '@errors/AppError.js'
import bcrypt from 'bcrypt'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { SignupCredentialsDTO } from '@/application/dtos/SignupCredentialsDTO.js'
import { BASE_COLORS } from '@constants/BASE_COLORS.js'
import { toMongoCaseKeys, toServerCaseKeys } from '@/utils/objectTransformers.js'
import { UserEditDTO } from '@dtos/UserEditDTO.js'
import { IUserCriteria } from '@interfaces/criterias/IUserCriteria.js'
import UserRepository from '@repositories/UserRepository.js'
import { SALT_ROUNDS } from '@constants/SALT_ROUNDS.js'
import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.js'

import { ClientSession, Types, UpdateWriteOpResult } from 'mongoose'
import sharp from 'sharp'
import { rm } from 'fs/promises'
import { EmailService } from '@/infrastructure/services/EmailService.js'
import { getCreditsUsed } from '@/utils/getCreditsUsed.js'
import { Redis } from 'ioredis'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { YandexUserDTO } from '../dtos/YandexUserDTO.js'
import { VkUserDTO } from '../dtos/VkUserDTO.js'
import { TokenKeysEnum } from '@/domain/enums/TokenKeysEnum.js'

const redis = new Redis()

export class UserService {
  protected repository: UserRepository
  protected emailService: EmailService

  constructor(repository: UserRepository, emailService: EmailService) {
    this.repository = repository
    this.emailService = emailService
  }

  public async create(data: Partial<IUser>, session?: ClientSession): Promise<IUser[]> {
    const result = await this.repository.create(data, session)

    return [toServerCaseKeys(result)]
  }

  public async createWithCredentials(
    credentials: SignupCredentialsDTO,
    session?: ClientSession,
  ): Promise<IUser[]> {
    const user: Partial<IUser> = {
      email: credentials.email.toLowerCase(),
      passwordHash: credentials.password,
      timezone: credentials.timezone,
      subscriptionId: SubscriptionPlanEnum.Basic,
      avatarColor: BASE_COLORS[Math.floor(Math.random() * 7)],
    }

    const result = await this.repository.create(user, session)

    return [toServerCaseKeys(result)]
  }

  public async createYandexUser(data: YandexUserDTO, session?: ClientSession): Promise<IUser[]> {
    const user: Partial<IUser> = {
      email: data.email.toLowerCase(),
      timezone: data.timezone,
      yandexClientId: data.clientId,
      isConfirmed: true,
      username: data.username,
      subscriptionId: SubscriptionPlanEnum.Basic,
      avatarColor: BASE_COLORS[Math.floor(Math.random() * 7)],
      avatarUrl: data.avatarUrl,
    }

    const result = await this.repository.create(user, session)

    return [toServerCaseKeys(result)]
  }

  public async createVkUser(data: VkUserDTO, session?: ClientSession): Promise<IUser[]> {
    const user: Partial<IUser> = {
      email: data.email.toLowerCase(),
      timezone: data.timezone,
      vkClientId: data.clientId,
      isConfirmed: true,
      username: data.username,
      subscriptionId: SubscriptionPlanEnum.Basic,
      avatarColor: BASE_COLORS[Math.floor(Math.random() * 7)],
      avatarUrl: data.avatarUrl,
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

  public async validateCredentials(email: string, passwordPlain: string): Promise<IUser> {
    const normalizedEmail = email.toLowerCase().trim()
    const user = await this.repository.findByEmail(normalizedEmail)

    if (!user) {
      throw new AppError(ErrorMessages.INVALID_CREDENTIALS, 401)
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password_hash!)

    if (!isMatch) {
      throw new AppError(ErrorMessages.INVALID_CREDENTIALS, 401)
    }

    return toServerCaseKeys(user)
  }

  public async getByVkClientId(id: string, session?: ClientSession): Promise<IUser | null> {
    if (!id) return null

    const users = await this.repository.findByCriteria({ vkClientId: id }, session)

    return toServerCaseKeys(users[0])
  }

  public async getById(id: string, session?: ClientSession): Promise<IUser | null> {
    if (!id) return null

    const users = await this.repository.findByCriteria({ id }, session)

    return toServerCaseKeys(users[0])
  }

  public async getByEmail(email: string, session?: ClientSession): Promise<IUser | null> {
    if (!email) return null

    const normalizedEmail = email.toLowerCase().trim()
    const users = await this.repository.findByCriteria({ email: normalizedEmail }, session)

    return toServerCaseKeys(users[0])
  }

  public async me(id: Types.ObjectId, session?: ClientSession): Promise<IUser | null> {
    const user = await this.getById(id.toString(), session)

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

  public async spendCredits(
    tokens: number,
    userId: string,
    modelType: ModelsEnum,
    session?: ClientSession,
  ) {
    const user = await this.getById(userId, session)

    if (!user) throw new AppError(ErrorMessages.USER_NOT_FOUND, 404)

    const amount = getCreditsUsed(tokens, modelType)

    let leftover = amount
    let newCredits = user.credits
    let newPaidCredits = user.paidCredits

    if (newCredits >= leftover) {
      newCredits -= leftover
      leftover = 0
    } else {
      leftover -= newCredits
      newCredits = 0
    }

    if (leftover > 0) {
      if (newPaidCredits >= leftover) {
        newPaidCredits -= leftover
        leftover = 0
      } else {
        newPaidCredits = 0
        leftover = 0
      }
    }

    await this.edit(
      {
        credits: newCredits,
        paidCredits: newPaidCredits,
      },
      { id: userId },
      undefined,
      session,
    )

    return amount
  }

  public async chargeAudioUsage(
    audioTokensUsed: number,
    user: IUser,
    externalSession?: ClientSession,
  ): Promise<number> {
    const chargedAudioTokens = await this.spendCredits(
      audioTokensUsed,
      user.id.toString(),
      ModelsEnum.KANWAY_AUDIO,
      externalSession,
    )

    await this.edit(
      {
        audioTokensUsed: 0,
      },
      { id: user.id.toString() },
      user,
      externalSession,
    )

    return chargedAudioTokens
  }

  public async addPaidCredits(
    userId: string,
    credits: number,
    session?: ClientSession,
  ): Promise<UpdateWriteOpResult> {
    return await this.repository.decrementFieldByCriteria(
      { id: userId },
      'paid_credits',
      -credits,
      session,
    )
  }

  public async appendUsedAudioTokens(tokensUsed: number, userId: string): Promise<void> {
    await this.repository.decrementFieldByCriteria({ id: userId }, 'audio_tokens_used', -tokensUsed)
  }

  public async verifyOTPEmail(code: string, email: string): Promise<string> {
    const otpKey = `${TokenKeysEnum.EMAIL_OTP_VERIFICATION}:${email}`
    const attemptsKey = `attempts:${otpKey}`
    const MAX_ATTEMPTS = 5

    const attempts = await redis.get(attemptsKey)
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
      await redis.del(otpKey)
      throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
    }

    const redisData = await redis.get(otpKey)

    if (!redisData) throw new AppError(ErrorMessages.OTP_INVALID_OR_EXPIRED, 410)

    const data = JSON.parse(redisData) as { userId: string; code: string; token: string }

    const linkKey = `${TokenKeysEnum.EMAIL_VERIFICATION}:${data.token}`

    if (data.code !== code) {
      const currentAttempts = await redis.incr(attemptsKey)

      if (currentAttempts === 1) {
        await redis.expire(attemptsKey, 600)
      }

      if (currentAttempts >= MAX_ATTEMPTS) {
        await Promise.all([redis.del(otpKey), redis.del(attemptsKey), redis.del(linkKey)])
        throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
      }

      throw new AppError(ErrorMessages.OTP_INVALID_OR_EXPIRED, 400)
    }

    await this.edit({ isConfirmed: true }, { id: data.userId })

    await Promise.all([redis.del(otpKey), redis.del(attemptsKey), redis.del(linkKey)])

    return data.userId
  }

  public async verifyLinkEmail(token: string): Promise<string> {
    const linkKey = `${TokenKeysEnum.EMAIL_VERIFICATION}:${token}`
    const attemptsKey = `attempts:${linkKey}`
    const MAX_ATTEMPTS = 5

    const attempts = await redis.get(attemptsKey)
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
      await redis.del(linkKey)
      throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
    }

    const userId = await redis.get(linkKey)

    if (!userId) throw new AppError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED, 410)

    await this.edit({ isConfirmed: true }, { id: userId })

    await Promise.all([redis.del(linkKey), redis.del(attemptsKey)])

    return userId
  }

  public async verifyOTPLogin(code: string, email: string): Promise<string> {
    const otpKey = `${TokenKeysEnum.LOGIN_OTP_VERIFICATION}:${email}`
    const attemptsKey = `attempts:${otpKey}`
    const MAX_ATTEMPTS = 5

    const attempts = await redis.get(attemptsKey)
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
      await redis.del(otpKey)
      throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
    }

    const redisData = await redis.get(otpKey)

    if (!redisData) throw new AppError(ErrorMessages.OTP_INVALID_OR_EXPIRED, 410)

    const data = JSON.parse(redisData) as { userId: string; code: string; token: string }

    const token = data.token
    const linkKey = `${TokenKeysEnum.LOGIN_VERIFICATION}:${token}`

    if (data.code !== code) {
      const currentAttempts = await redis.incr(attemptsKey)

      if (currentAttempts === 1) {
        await redis.expire(attemptsKey, 600)
      }

      if (currentAttempts >= MAX_ATTEMPTS) {
        await Promise.all([redis.del(otpKey), redis.del(attemptsKey), redis.del(linkKey)])
        throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
      }

      throw new AppError(ErrorMessages.OTP_INVALID_OR_EXPIRED, 400)
    }

    await Promise.all([redis.del(otpKey), redis.del(attemptsKey), redis.del(linkKey)])

    return data.userId
  }

  public async verifyLinkLogin(token: string): Promise<string> {
    const linkKey = `${TokenKeysEnum.LOGIN_VERIFICATION}:${token}`
    const attemptsKey = `attempts:${linkKey}`
    const MAX_ATTEMPTS = 5

    const attempts = await redis.get(attemptsKey)
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
      await redis.del(linkKey)
      throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
    }

    const userId = await redis.get(linkKey)

    if (!userId) throw new AppError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED, 410)

    await Promise.all([redis.del(linkKey), redis.del(attemptsKey)])

    return userId
  }

  public async verifyOTPPassword(code: string, email: string): Promise<string> {
    const otpKey = `${TokenKeysEnum.PASSWORD_OTP_RECOVERY}:${email}`
    const attemptsKey = `attempts:${otpKey}`
    const MAX_ATTEMPTS = 5

    const attempts = await redis.get(attemptsKey)
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
      await redis.del(otpKey)
      throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
    }

    const redisData = await redis.get(otpKey)

    if (!redisData) throw new AppError(ErrorMessages.OTP_INVALID_OR_EXPIRED, 410)

    const data = JSON.parse(redisData) as { userId: string; code: string; token: string }

    const token = data.token

    const linkKey = `${TokenKeysEnum.PASSWORD_RECOVERY}:${token}`

    if (data.code !== code) {
      const currentAttempts = await redis.incr(attemptsKey)

      if (currentAttempts === 1) {
        await redis.expire(attemptsKey, 600)
      }

      if (currentAttempts >= MAX_ATTEMPTS) {
        await Promise.all([redis.del(otpKey), redis.del(attemptsKey), redis.del(linkKey)])
        throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
      }

      throw new AppError(ErrorMessages.OTP_INVALID_OR_EXPIRED, 400)
    }

    await Promise.all([redis.del(otpKey), redis.del(attemptsKey), redis.del(linkKey)])

    return data.userId
  }

  public async verifyLinkPassword(token: string): Promise<string> {
    const linkKey = `${TokenKeysEnum.PASSWORD_RECOVERY}:${token}`
    const attemptsKey = `attempts:${linkKey}`
    const MAX_ATTEMPTS = 5

    const attempts = await redis.get(attemptsKey)
    if (attempts && parseInt(attempts) >= MAX_ATTEMPTS) {
      await redis.del(linkKey)
      throw new AppError(ErrorMessages.TOO_MANY_ATTEMPTS_EXPIRED, 429)
    }

    const userId = await redis.get(linkKey)

    if (!userId) throw new AppError(ErrorMessages.TOKEN_INVALID_OR_EXPIRED, 410)

    await Promise.all([redis.del(linkKey), redis.del(attemptsKey)])

    return userId
  }

  public async checkEmailExists(email: string, ip?: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim()

    let limitKey = `auth_limit:${normalizedEmail}`
    if (ip) {
      limitKey = `auth_limit:${normalizedEmail}:${ip}`
    }
    const MAX_ATTEMPTS = 5
    const WINDOW_SECONDS = 60

    const currentAttempts = await redis.incr(limitKey)

    if (currentAttempts === 1) {
      await redis.expire(limitKey, WINDOW_SECONDS)
    }

    if (currentAttempts > MAX_ATTEMPTS) {
      const ttl = await redis.ttl(limitKey)
      throw new AppError(
        `Слишком много попыток. Попробуйте через ${ttl > 0 ? ttl : WINDOW_SECONDS} сек.`,
        429,
      )
    }

    const count = await this.repository.getCount({
      email: normalizedEmail,
    })

    return count > 0
  }
}
