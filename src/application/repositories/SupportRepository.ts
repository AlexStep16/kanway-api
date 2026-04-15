import { ISupport } from '@entities/ISupport.js'
import { ISupportRaw } from '@entities/ISupportRaw.js'
import SupportModel from '@models/SupportModel.js'
import { BaseRepository } from '@repositories/BaseRepository.js'

export default class SupportRepository extends BaseRepository<ISupportRaw, ISupport> {
  constructor() {
    super(SupportModel)
  }
}
