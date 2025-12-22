import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { NextFunction, Request, Response } from 'express'
import { ChatService } from '@/application/services/ChatService.ts'
import { ChatCriteria } from '@/application/interfaces/criterias/ChatCriteria.ts'
import { langgraphQueue, langgraphQueueEvents } from '@/infrastructure/queues/index.ts'

export default class ChatController {
  protected service: ChatService

  constructor(serviceInstance: ChatService) {
    this.service = serviceInstance
  }

  public async streamStatus(req: Request, res: Response) {
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

      try {
        const result =
          typeof args.returnvalue === 'string' ? JSON.parse(args.returnvalue) : args.returnvalue

        if (result?.status === 'interrupted') {
          langgraphQueue.add('resume', { messages: result.messages, config: result.config })
        }
      } catch {
        console.error(`API: Failed to parse return value for job ${userjobId}:`, args.returnvalue)
      }

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
    try {
      const result = await this.service.send(req.body, req.user!)

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public async approveToolCall(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.service.approveToolCall(req.body, req.user!)

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: ChatCriteria = { ...req.query, workspaceId: req.params.workspaceId }
      const entities = await this.service.getAll(filter, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
