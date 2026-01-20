import { IReordable } from '@entities/IReordable.ts'
import { ClientSession, Types } from 'mongoose'
import { BaseRepository } from '../repositories/BaseRepository.ts'
import { BaseService } from './BaseService.ts'

export class ReorderService<
  TEntity extends IReordable,
  TRawEntity,
  TCriteria,
  TResult = TEntity,
  TCreatePayload = Partial<TEntity>
> extends BaseService<TRawEntity, TEntity, TCriteria, TResult, TCreatePayload> {
  protected repository: BaseRepository<TRawEntity, TEntity, TCriteria, TCreatePayload>

  constructor(repository: BaseRepository<TRawEntity, TEntity, TCriteria, TCreatePayload>) {
    super(repository)

    this.repository = repository
  }

  private async _baseReorderLogic(
    entities: IReordable[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TResult[]> {
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

      const updatedEntities = await this.getByCriteria(
        { ids: entitiesToUpdate.map((e) => e.id) } as TCriteria,
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
  ): Promise<TResult[]> {
    const allUpdatedEntities: TResult[] = []
    const groupedEntities = newEntities.reduce((map, entity) => {
      const parentId = entity[parentIdKey] as Types.ObjectId

      map.set(parentId.toString(), [...(map.get(parentId.toString()) || []), entity])

      return map
    }, new Map<string, TEntity[]>())

    for (let [parentId, newItems] of groupedEntities.entries()) {
      const newEntitiesIds = newItems.map((e) => e.id.toString())
      const entities: IReordable[] = await this.repository.getAllToOrder(
        new Types.ObjectId(parentId),
        parentIdKey as string,
        userId,
        session
      )
      const entitiesOld = entities.filter((e) => !newEntitiesIds.includes(e.id.toString()))

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
    parentField: keyof TEntity,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TResult[]> {
    const uniqueParentIds = Array.from(new Set(parentIds.map((id) => id.toHexString()))).map(
      (id) => new Types.ObjectId(id)
    )
    const allUpdatedEntities: TResult[] = []

    for (let parentId of uniqueParentIds) {
      const entities: IReordable[] = await this.repository.getAllToOrder(
        parentId,
        parentField as string,
        userId,
        session
      )

      const updatedEntities = await this._baseReorderLogic(entities, userId, session)
      allUpdatedEntities.push(...updatedEntities)
    }

    return allUpdatedEntities
  }
}
