import SettingRepository from '@repositories/SettingRepository.js'
import type { DeleteResult } from 'mongodb'
import { ISetting } from '@entities/ISetting.js'
import { ISettingRaw } from '@entities/ISettingRaw.js'
import { SettingDTO } from '@dtos/SettingDTO.js'
import { SettingEditDTO } from '@dtos/SettingEditDTO.js'
import { ISettingCriteria } from '@criterias/ISettingCriteria.js'
import { ClientSession, Types } from 'mongoose'
import { SystemFields } from '@infrastructure/types/SystemFields.js'
import { IUser } from '@/domain/entities/IUser.js'
import { BaseService } from './BaseService.js'

export class SettingService extends BaseService<ISettingRaw, ISetting, ISettingCriteria> {
  protected repository: SettingRepository

  constructor(settingRepository: SettingRepository) {
    super(settingRepository)

    this.repository = settingRepository
  }

  public async create(
    data: SettingDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ISetting> {
    const setting: Omit<ISetting, SystemFields> = {
      aiName: data.aiName,
      aiConfirmationType: data.aiConfirmationType,
      aiDefaultColumn: data.aiDefaultColumn ?? '',
      aiDefaultBoard: data.aiDefaultBoard ?? '',
      userId: userId,
    }

    return await this.repository.create(setting, session)
  }

  public async edit(
    data: SettingEditDTO,
    criteria: ISettingCriteria,
    user: IUser,
  ): Promise<ISetting[]> {
    const updateSettingResult = await this.repository.updateManyByCriteria(
      criteria,
      data,
      undefined,
      user.id,
    )

    if (updateSettingResult.modifiedCount === 0) {
      throw new Error('Настройки пользователя не найдены')
    }

    return await this.getByCriteria({ userId: user.id.toString() })
  }

  public async delete(
    criteria: ISettingCriteria,
    user: IUser,
    session?: ClientSession,
  ): Promise<DeleteResult> {
    return await this.repository.deleteMany(criteria, user.id, session)
  }
}
