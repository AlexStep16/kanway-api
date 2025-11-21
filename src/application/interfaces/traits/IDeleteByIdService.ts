import { ClientSession, Types } from 'mongoose'

export interface IDeleteByIdService {
  deleteById(id: string, userId: Types.ObjectId, session?: ClientSession): Promise<void>
}
