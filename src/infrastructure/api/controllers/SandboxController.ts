import { ToolDispatcherService } from '@/application/ai/services/ToolDispatcherService.ts'
import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { NextFunction, Request, Response } from 'express'

export default class SandboxController {
  protected toolDispatcherService: ToolDispatcherService

  constructor(toolDispatcherService: ToolDispatcherService) {
    this.toolDispatcherService = toolDispatcherService
  }

  public executeTool = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.user_id as string
      const config = req.body.config as Record<string, any>

      const result = await this.toolDispatcherService.dispatch({
        toolCall: req.body,
        userId,
        config,
        tempToRealIdMap: {}, // Initialize an empty map for this execution context
      })

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public test = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await fetch('http://localhost:8000/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `
tasks_result = search_tasks(
    mongo_filter={
        "board": "69b9757502918145c4e83247"
    },
    search_query="",
    search_mode="fuzzy",
    limit=200
)
print(tasks_result)`,
          config: {},
          user_id: '67da84f0a2e3729760781559',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Sandbox execution failed: ${errorText}`)
      } else {
        const result = await response.json()

        return res.status(200).json(new SuccessResponse(result))
      }
    } catch (error) {
      console.error('Error in SandboxController.test:', error)
      next(error)
    }
  }
}
