import SettingRepository from '@repositories/SettingRepository.ts'
import { ISetting } from '@entities/ISetting.ts'
import { ISettingRaw } from '@entities/ISettingRaw.ts'
import { SettingDTO } from '@dtos/SettingDTO.ts'
import { toMongoCaseKeys, toServerCaseKeys } from '@utils/objectTransformers.ts'
import { SettingEditDTO } from '@dtos/SettingEditDTO.ts'
import { SettingCriteria } from '@criterias/SettingCriteria.ts'
import { ClientSession, Types } from 'mongoose'
import { SystemFields } from '@/infrastructure/types/SystemFields.ts'
import { ICreateWithUserIdService } from '../interfaces/traits/ICreateWithUserIdService.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { IEditService } from '../interfaces/traits/IEditService.ts'
import { IGetAllByUserIdService } from '../interfaces/traits/IGetAllByUserIdService.ts'

export class SettingService
  implements
    ICreateWithUserIdService<ISetting, SettingDTO>,
    IEditService<SettingCriteria, ISetting, SettingEditDTO>,
    IGetAllByUserIdService<ISetting>
{
  protected repository: SettingRepository

  constructor(settingRepository: SettingRepository) {
    this.repository = settingRepository
  }

  public async create(
    data: SettingDTO,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ISetting[]> {
    const setting: Omit<ISettingRaw, SystemFields> = {
      ai_name: data.aiName,
      ai_confirmation_type: data.aiConfirmationType,
      ai_default_category: data.aiDefaultCategory ?? '',
      ai_default_board: data.aiDefaultBoard ?? '',
      user_id: userId,
    }

    const result = await this.repository.create(setting, session)

    return [toServerCaseKeys(result)]
  }

  public async edit(
    data: SettingEditDTO,
    criteria: SettingCriteria,
    user: IUser
  ): Promise<ISetting[]> {
    const filter = this.repository.buildFilter(criteria, user.id)
    const payload = toMongoCaseKeys<ISettingRaw>(data)

    const updatedSetting = await this.repository.updateByFilter(filter, payload)

    return updatedSetting.map(toServerCaseKeys<ISetting>)
  }

  public async getAllByUserId(
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ISetting[]> {
    const settings = await this.repository.getByUserId(userId, session)

    return settings.map(toServerCaseKeys<ISetting>)
  }
}
