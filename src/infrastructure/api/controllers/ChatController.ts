import SuccessResponse from '@/application/services/SuccessResponse.js'
import { NextFunction, Request, Response } from 'express'
import { ChatService } from '@/application/services/ChatService.js'
import { IChatCriteria } from '@/application/interfaces/criterias/IChatCriteria.js'
import { langgraphQueue } from '@/infrastructure/queues/index.js'
import mongoose from 'mongoose'
import { Redis } from 'ioredis'

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

  public async streamStatus(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const userjobId = req.params.jobId

    const subscriber = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    })

    const closeConnection = async () => {
      if (res.writableEnded) return

      await subscriber.unsubscribe().catch(() => {})
      await subscriber.quit().catch(() => {})
      res.end()
    }

    const sentIds = new Set<string>()
    const healthCheckInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(healthCheckInterval)
        return
      }
      res.write(':ping\n\n')
    }, 5000)

    const sendEvent = (event: any) => {
      const eventId = event.id || JSON.stringify(event)
      if (!sentIds.has(eventId)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
        sentIds.add(eventId)
      }
    }

    await subscriber.subscribe(`job-events:${userjobId}`)

    subscriber.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message) as {
          id: string
          role?: string
          data?: any
          status?: 'completed' | 'failed'
        }

        sendEvent(event)

        if (event.status && (event.status === 'completed' || event.status === 'failed')) {
          closeConnection()
        }
      } catch (e) {
        console.error('Failed to parse SSE event', e)
      }
    })

    const job = await langgraphQueue.getJob(userjobId)

    if (job) {
      if (Array.isArray(job.progress)) {
        job.progress.forEach((oldEvent: any) => sendEvent(oldEvent))
      }

      const state = await job.getState()
      if (state === 'completed' || state === 'failed') {
        return await closeConnection()
      }
    }

    req.on('close', async () => {
      await closeConnection()
      if (job) {
        await job.updateData({
          ...job.data,
          __abortSignal: true,
        })
      }
      clearInterval(healthCheckInterval)
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

      await langgraphQueue.add('process_query', result.jobPayload, {
        jobId: req.body.jobId,
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

  public async updateChatName(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.service.updateChatName(req.body, req.params.id, req.user!)

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
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

  public async approveTool(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.service.approveTool(req.body, req.user!)

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
