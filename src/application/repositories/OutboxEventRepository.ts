import OutboxEvent from '@models/OutboxEvent.js'
import { IOutboxEventRaw } from '@entities/IOutboxEventRaw.js'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { IOutboxEventCriteria } from '@interfaces/criterias/IOutboxEventCriteria.js'
import { FilterQuery, Types } from 'mongoose'
import { IOutboxEvent } from '@entities/IOutboxEvent.js'
import { OutboxEventStatusEnum } from '@/domain/enums/OutboxEventStatusEnum.js'
import { mongo } from 'mongoose'
import { OutboxEventDTO } from '../dtos/OutboxEventDTO.js'

export default class OutboxEventRepository extends BaseRepository<
  IOutboxEventRaw,
  IOutboxEvent,
  IOutboxEventCriteria,
  OutboxEventDTO
> {
  constructor() {
    super(OutboxEvent)
  }

  public buildFilter(
    criteria: IOutboxEventCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<IOutboxEventRaw> {
    const filter: FilterQuery<IOutboxEventRaw> = {}

    if (userId) {
      filter.user_id = userId
    }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.status) {
      filter.status = criteria.status
    } else if (criteria.statuses) {
      filter.status = { $in: criteria.statuses }
    }

    return filter
  }

  public watchPendingInserts(): mongo.ChangeStream {
    return this.model.watch([
      {
        $match: {
          operationType: 'insert',
          'fullDocument.status': OutboxEventStatusEnum.PENDING,
        },
      },
    ])
  }
}
