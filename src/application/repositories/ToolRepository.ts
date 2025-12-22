import { IToolRaw } from '@entities/IToolRaw.ts'
import ToolModel from '@models/ToolModel.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class ToolRepository extends BaseRepository<IToolRaw, typeof ToolModel> {
  constructor() {
    super(ToolModel)
  }
}
