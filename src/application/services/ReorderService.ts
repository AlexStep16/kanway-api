import { IReordable } from '@entities/IReordable.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'
import { ClientSession, Types } from 'mongoose'

export class ReorderService<TEntity extends IReordable> {
  protected repository: IReorderRepository<TEntity>

  constructor(repository: IReorderRepository<TEntity>) {
    this.repository = repository
  }

  public async reorder(
    parentId: string,
    newOrders: IReordable[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const entities: IReordable[] = await this.repository.getAllToOrder(parentId, userId)
    const entitiesOld = entities.filter((e) => !newOrders.find((no) => no._id.equals(e._id)))
    const newEntities: IReordable[] = []

    for (let newOrder of newOrders) {
      const newIndex = newOrder.order - 1
      const newItem = newOrder

      entitiesOld.splice(newIndex, 0, newItem)
    }

    for (let i = 0; i < entitiesOld.length; i++) {
      const entity = entitiesOld[i]

      if (entity.order !== i + 1) {
        entity.order = i + 1
        newEntities.push(entity)
      }
    }

    if (newEntities.length > 0) {
      this.repository.bulkUpdateOrders(newEntities, session)
    }
  }
}
