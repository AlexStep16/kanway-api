import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import { IPaymentRaw } from '@entities/IPaymentRaw.ts'
import PaymentModel from '@models/PaymentModel.ts'
import { ClientSession, Types } from 'mongoose'

export default class PaymentRepository {
  public async create(
    data: Omit<IPaymentRaw, SystemFields>,
    session?: ClientSession
  ): Promise<IPaymentRaw> {
    const [newDoc] = await PaymentModel.create([data], { session })

    return newDoc
  }

  public async getByUserId(
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPaymentRaw[]> {
    return await PaymentModel.find({ user_id: userId })
      .session(session ?? null)
      .lean()
  }

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPaymentRaw | null> {
    return await PaymentModel.findOne({ _id: id, user_id: userId })
      .session(session ?? null)
      .lean()
  }
}
