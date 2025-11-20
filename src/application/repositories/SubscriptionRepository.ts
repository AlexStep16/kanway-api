import SubscriptionModel from '@/domain/models/SubscriptionModel.ts'
import { ISubscriptionRaw } from '@/domain/entities/ISubscriptionRaw.ts'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'

export default class SubscriptionRepository {
  public async create(data: Omit<ISubscriptionRaw, SystemFields>): Promise<ISubscriptionRaw> {
    const [newDoc] = await SubscriptionModel.create([data])

    return newDoc
  }

  public async findById(id: string): Promise<ISubscriptionRaw | null> {
    return await SubscriptionModel.findById(id).lean()
  }

  public async findByCustomId(id: SubscriptionPlanEnum): Promise<ISubscriptionRaw | null> {
    return await SubscriptionModel.findOne({ id }).lean()
  }
}
