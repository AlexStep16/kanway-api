import { IOutboxEventCriteria } from '../interfaces/criterias/IOutboxEventCriteria.js'
import { IOutboxEvent } from '@/domain/entities/IOutboxEvent.js'
import { IOutboxEventRaw } from '@/domain/entities/IOutboxEventRaw.js'
import { BaseService } from './BaseService.js'
import OutboxEventRepository from '../repositories/OutboxEventRepository.js'
import { ClientSession } from 'mongoose'
import { OutboxEventDTO } from '../dtos/OutboxEventDTO.js'
import { OutboxEventEditDTO } from '../dtos/OutboxEventEditDTO.js'

export class OutboxEventService extends BaseService<
  IOutboxEventRaw,
  IOutboxEvent,
  IOutboxEventCriteria,
  IOutboxEvent,
  OutboxEventDTO
> {
  protected repository: OutboxEventRepository

  constructor(outboxEventRepository: OutboxEventRepository) {
    super(outboxEventRepository)

    this.repository = outboxEventRepository
  }

  public async create(data: OutboxEventDTO, session?: ClientSession): Promise<IOutboxEvent> {
    return await this.repository.create(data, session)
  }

  public async edit(
    data: OutboxEventEditDTO,
    criteria: IOutboxEventCriteria,
  ): Promise<IOutboxEvent[]> {
    const updateOutboxEventResult = await this.repository.updateManyByCriteria(criteria, data)

    if (updateOutboxEventResult.modifiedCount === 0) {
      throw new Error('No outbox events were updated. Please check the criteria and try again.')
    }

    return await this.getByCriteria(criteria)
  }
}
