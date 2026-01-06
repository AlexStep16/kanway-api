import { IReordable } from '@entities/IReordable.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'
import { ClientSession, Types } from 'mongoose'

export class ReorderService<TEntity extends IReordable> {
  protected repository: IReorderRepository<TEntity>

  constructor(repository: IReorderRepository<TEntity>) {
    this.repository = repository
  }

  private async _baseReorderLogic(
    entities: IReordable[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]> {
    const entitiesToUpdate: IReordable[] = []

    for (let i = 0; i < entities.length; i++) {
      const entity = { ...entities[i] }

      if (entity.order !== i + 1) {
        entity.order = i + 1
        entitiesToUpdate.push(entity)
      }
    }

    if (entitiesToUpdate.length > 0) {
      await this.repository.bulkUpdateOrders(entitiesToUpdate, userId, session)

      const updatedEntities = await this.repository.findByIds(
        entitiesToUpdate.map((e) => e._id),
        userId,
        session
      )

      return updatedEntities
    }

    return []
  }

  public async reorder(
    parentIdKey: keyof TEntity,
    newEntities: TEntity[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]> {
    const allUpdatedEntities: TEntity[] = []
    const groupedEntities = newEntities.reduce((map, entity) => {
      const parentId = entity[parentIdKey] as Types.ObjectId

      map.set(parentId.toString(), [...(map.get(parentId.toString()) || []), entity])

      return map
    }, new Map<string, TEntity[]>())

    for (let [parentId, newItems] of groupedEntities.entries()) {
      const newEntitiesIds = newItems.map((e) => e._id.toString())
      const entities: IReordable[] = await this.repository.getAllToOrder(
        new Types.ObjectId(parentId),
        userId
      )
      const entitiesOld = entities.filter((e) => !newEntitiesIds.includes(e._id.toString()))

      newItems.sort((a, b) => a.order - b.order)

      for (let newEntity of newItems) {
        const newIndex = newEntity.order - 1

        entitiesOld.splice(newIndex, 0, newEntity)
      }

      const updatedEntities = await this._baseReorderLogic(entitiesOld, userId, session)
      allUpdatedEntities.push(...updatedEntities)
    }

    return allUpdatedEntities
  }

  public async reorderByParentIds(
    parentIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]> {
    const uniqueParentIds = Array.from(new Set(parentIds.map((id) => id.toHexString()))).map(
      (id) => new Types.ObjectId(id)
    )
    const allUpdatedEntities: TEntity[] = []

    for (let parentId of uniqueParentIds) {
      const entities: IReordable[] = await this.repository.getAllToOrder(parentId, userId, session)

      const updatedEntities = await this._baseReorderLogic(entities, userId, session)
      allUpdatedEntities.push(...updatedEntities)
    }

    return allUpdatedEntities
  }
}
