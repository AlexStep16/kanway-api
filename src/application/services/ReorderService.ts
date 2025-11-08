import { IReordable } from '@entities/IReordable.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'
import { ClientSession, Types } from 'mongoose'
import { ReorderResultDTO } from '@dtos/ReorderResultDTO.ts'
import { CollectionsEnum } from '@domain/enums/CollectionsEnum.ts'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'

export class ReorderService<TEntity extends IReordable> {
  protected repository: IReorderRepository<TEntity>
  protected operationLogService: OperationLogService

  constructor(repository: IReorderRepository<TEntity>, operationLogService: OperationLogService) {
    this.repository = repository
    this.operationLogService = operationLogService
  }

  private async _baseReorderLogic(
    entities: IReordable[],
    collectionName: CollectionsEnum,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ReorderResultDTO<TEntity>> {
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

      /* LOG */
      const logs = await this.operationLogService.create(
        {
          operationType: OperationTypesEnum.UPDATE,
          collectionName,
          entitiesBefore: entities,
          entitiesAfter: updatedEntities,
          dependencies: [],
        },
        userId,
        session
      )

      return {
        updatedEntities,
        log: logs[0],
      }
    }

    return {
      updatedEntities: [],
      log: null,
    }
  }

  public async reorder(
    parentIdKey: keyof TEntity,
    newEntities: TEntity[],
    collectionName: CollectionsEnum,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ReorderResultDTO<TEntity>[]> {
    const allUpdatedEntities: ReorderResultDTO<TEntity>[] = []
    const groupedEntities = newEntities.reduce((map, entity) => {
      const parentId = entity[parentIdKey] as Types.ObjectId
      map.set(parentId, [...(map.get(parentId) || []), entity])
      return map
    }, new Map<Types.ObjectId, TEntity[]>())

    for (let [parentId, newItems] of groupedEntities.entries()) {
      const newEntitiesIds = newItems.map((e) => e._id.toString())
      const entities: IReordable[] = await this.repository.getAllToOrder(parentId, userId)
      const entitiesOld = entities.filter((e) => !newEntitiesIds.includes(e._id.toString()))

      for (let newEntity of newItems) {
        const newIndex = newEntity.order - 1

        entitiesOld.splice(newIndex, 0, newEntity)
      }

      const updatedEntities = await this._baseReorderLogic(
        entitiesOld,
        collectionName,
        userId,
        session
      )
      allUpdatedEntities.push(updatedEntities)
    }

    return allUpdatedEntities
  }

  public async reorderByParentIds(
    parentIds: Types.ObjectId[],
    collectionName: CollectionsEnum,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ReorderResultDTO<TEntity>[]> {
    const uniqueParentIds = Array.from(new Set(parentIds.map((id) => id.toHexString()))).map(
      (id) => new Types.ObjectId(id)
    )
    const allUpdatedEntities: ReorderResultDTO<TEntity>[] = []

    for (let parentId of uniqueParentIds) {
      const entities: IReordable[] = await this.repository.getAllToOrder(parentId, userId, session)

      const updatedEntities = await this._baseReorderLogic(
        entities,
        collectionName,
        userId,
        session
      )
      allUpdatedEntities.push(updatedEntities)
    }

    return allUpdatedEntities
  }
}
