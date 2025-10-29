import { IUser } from '@entities/IUser.ts'
import { UserModel } from '@models/UserModel.ts' // Mongoose Model
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class UserRepository extends BaseRepository<IUser, typeof UserModel> {
  constructor() {
    super(UserModel)
  }

  public async findByEmail(email: string): Promise<IUser | null> {
    const user = await UserModel.findByEmailWithPassword(email)

    return user
  }
}
