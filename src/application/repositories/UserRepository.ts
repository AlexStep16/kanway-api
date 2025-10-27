import { IUser } from '@entities/IUser.ts'
import { UserModel } from '@models/UserModel.ts' // Mongoose Model

export default class UserRepository {
  public async findByEmail(email: string): Promise<IUser | null> {
    const user = await UserModel.findByEmailWithPassword(email)

    return user
  }

  public async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new UserModel(userData)

    await user.save()

    return user.toObject()
  }

  public async getById(id: string): Promise<IUser | null> {
    const user = await UserModel.findById(id).lean()

    return user
  }
}
