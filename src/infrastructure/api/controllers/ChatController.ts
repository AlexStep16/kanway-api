import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { NextFunction, Request, Response } from 'express'
import { ChatService } from '@/application/services/ChatService.ts'
import { IChatCriteria } from '@/application/interfaces/criterias/IChatCriteria.ts'
import { langgraphQueue, langgraphQueueEvents } from '@/infrastructure/queues/index.ts'
import mongoose from 'mongoose'
import { CustomEvents } from '@/enums/CustomEvents.ts'

export default class ChatController {
  protected service: ChatService

  constructor(serviceInstance: ChatService) {
    this.service = serviceInstance
  }

  public getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = { id: req.params.id }

      const entity = await this.service.getByCriteria(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entity))
    } catch (error) {
      next(error)
    }
  }

  public update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.edit(req.body, { id: req.params.id }, req.user!)

      res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public streamStatus(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const userjobId = req.params.jobId

    const onProgress = ({ jobId, data }: { jobId: string; data: any }) => {
      if (jobId !== userjobId) return // Игнорируем события не для этого jobId

      res.write(`data: ${JSON.stringify({ status: 'progress', data: data })}\n\n`)
    }

    const onCompleted = (args: {
      jobId: string
      returnvalue: string
      prev?: string | undefined
    }) => {
      if (userjobId !== args.jobId) return // Игнорируем события не для этого jobId

      res.write(`data: ${JSON.stringify({ status: 'completed', result: args.returnvalue })}\n\n`)
      res.end() // Закрываем соединение
    }

    const onFailed = (event: { failedReason: string; jobId: string }) => {
      if (userjobId !== event.jobId) return // Игнорируем события не для этого jobId

      res.write(`data: ${JSON.stringify({ status: 'failed', error: event.failedReason })}\n\n`)
      res.end()
    }

    langgraphQueueEvents.on(`progress`, onProgress)
    langgraphQueueEvents.on(`completed`, onCompleted)
    langgraphQueueEvents.on(`failed`, onFailed)

    req.on('close', () => {
      langgraphQueueEvents.removeListener(`progress`, onProgress)
      langgraphQueueEvents.removeListener(`completed`, onCompleted)
      langgraphQueueEvents.removeListener(`failed`, onFailed)
    })
  }

  public async send(req: Request, res: Response, next: NextFunction) {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const clientDisconnected = new Promise((_, reject) => {
        req.on('close', () => {
          if (!res.writableEnded) {
            reject(new Error('CLIENT_ABORTED'))
          }
        })
      })

      const result = (await Promise.race([
        clientDisconnected,
        (async () => {
          return await this.service.send(req.body, req.user!, session)
        })(),
      ])) as Awaited<ReturnType<ChatService['send']>>

      await session.commitTransaction()

      const job = await langgraphQueue.add('process_query', result.jobPayload, {
        jobId: req.body.jobId,
      })

      await job.updateProgress({
        role: CustomEvents.NEW_MESSAGE,
        data: result.userMessage,
      })

      await job.updateProgress({
        role: CustomEvents.NEW_MESSAGE,
        data: result.stepMessage,
      })

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      await session.abortTransaction()

      const job = await langgraphQueue.getJob(req.params.jobId)

      if (job) {
        await job.updateData({
          ...job.data,
          __abortSignal: true,
        })
      }

      if (error && error instanceof Error && error.message !== 'CLIENT_ABORTED') next(error)
    } finally {
      session.endSession()
    }
  }

  public async retry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.service.retry(req.body, req.user!)

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public async approveLog(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.service.approveLog(req.body, req.user!)

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public async resolveAmbiguous(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.service.resolveAmbiguous(req.body, req.user!)

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public async stopAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const { jobId } = req.params

      await this.service.stopAgent({ jobId, ...req.body })

      return res.status(200).json(new SuccessResponse('Агент остановлен.'))
    } catch (error) {
      next(error)
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      await this.service.delete({ id }, req.user!)

      return res.status(200).json(new SuccessResponse(null))
    } catch (error) {
      next(error)
    }
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: IChatCriteria = { ...req.query }
      const entities = await this.service.getByCriteria(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
