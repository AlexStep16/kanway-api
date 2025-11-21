import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import { IPaymentMethodRaw } from '@entities/IPaymentMethodRaw.ts'
import PaymentMethodModel from '@models/PaymentMethodModel.ts'
import { ClientSession, Types } from 'mongoose'

export default class PaymentMethodRepository {
  public async create(
    data: Omit<IPaymentMethodRaw, SystemFields>,
    session?: ClientSession
  ): Promise<IPaymentMethodRaw> {
    const [newDoc] = await PaymentMethodModel.create([data], { session })

    return newDoc
  }

  public async getByUserId(
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPaymentMethodRaw[]> {
    return await PaymentMethodModel.find({ user_id: userId })
      .session(session ?? null)
      .sort({ createdAt: 1 })
      .lean()
  }

  public async deleteById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    await PaymentMethodModel.deleteOne({ _id: id, user_id: userId }).session(session ?? null)
  }

  public async getById(
    id: string,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IPaymentMethodRaw | null> {
    return await PaymentMethodModel.findOne({ _id: id, user_id: userId })
      .session(session ?? null)
      .lean()
  }
}
