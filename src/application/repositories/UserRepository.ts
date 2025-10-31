import { IUserRaw } from '@entities/IUserRaw.ts'
import { UserModel } from '@models/UserModel.ts' // Mongoose Model
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class UserRepository extends BaseRepository<IUserRaw, typeof UserModel> {
  constructor() {
    super(UserModel)
  }

  public async findByEmail(email: string): Promise<IUserRaw | null> {
    const user = await UserModel.findByEmailWithPassword(email)

    return user
  }
}
