import SettingRepository from '@repositories/SettingRepository.ts'
import { ISetting } from '@entities/ISetting.ts'
import { ISettingRaw } from '@entities/ISettingRaw.ts'
import { SettingDTO } from '@dtos/SettingDTO.ts'
import { toMongoCaseKeys, toServerCaseKeys } from '@utils/objectTransformers.ts'
import { SettingEditDTO } from '@dtos/SettingEditDTO.ts'
import { ISettingCriteria } from '@criterias/ISettingCriteria.ts'
import { ClientSession, Types } from 'mongoose'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { BaseService } from './BaseService.ts'

export class SettingService extends BaseService<ISettingRaw, ISetting, ISettingCriteria> {
  protected repository: SettingRepository

  constructor(settingRepository: SettingRepository) {
    super(settingRepository)

    this.repository = settingRepository
  }

  public async create(
    data: SettingDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ISetting> {
    const setting: Omit<ISetting, SystemFields> = {
      aiName: data.aiName,
      aiConfirmationType: data.aiConfirmationType,
      aiDefaultCategory: data.aiDefaultCategory ?? '',
      aiDefaultBoard: data.aiDefaultBoard ?? '',
      userId: userId,
    }

    return await this.repository.create(setting, session)
  }

  public async edit(
    data: SettingEditDTO,
    criteria: ISettingCriteria,
    user: IUser
  ): Promise<ISetting[]> {
    const payload = toMongoCaseKeys<ISetting>(data)

    const updateSettingResult = await this.repository.updateManyByCriteria(
      criteria,
      payload,
      undefined,
      user.id
    )

    if (updateSettingResult.modifiedCount === 0) {
      throw new Error('Настройки пользователя не найдены')
    }

    const updatedSetting = await this.repository.findByCriteria(criteria)

    return updatedSetting.map(toServerCaseKeys<ISetting>)
  }
}
