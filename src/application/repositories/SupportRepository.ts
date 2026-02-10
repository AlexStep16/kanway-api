import { ISupport } from '@entities/ISupport.ts'
import { ISupportRaw } from '@entities/ISupportRaw.ts'
import SupportModel from '@models/SupportModel.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class SupportRepository extends BaseRepository<ISupportRaw, ISupport> {
  constructor() {
    super(SupportModel)
  }
}
