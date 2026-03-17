import { ToolDispatcherService } from '@/application/aiNew/services/ToolDispatcherService.ts'
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

      const result = await this.toolDispatcherService.dispatch(req.body, userId, config)

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
# Search for the task with the given title
search_result = search_tasks(
    mongo_filter={"is_deleted": {"$ne": True}, "is_deleted_external": {"$ne": True}},
    search_query="поехать в театр"
)
tasks = search_result.get("tasks", [])
if not tasks:
    print("Task titled 'поехать в театр' was not found.")
    raise Exception("Task not found")

# Resolve ambiguity if multiple tasks match the title
if len(tasks) > 1:
    task_ids = [t["_id"] for t in tasks]
    selected_ids = resolve_ambiguous(
        entity_type="task",
        ids=task_ids,
        min_select=1,
        max_select=1,
        id="resolve_task_tag_change"
    )
    task_id = selected_ids[0]
else:
    task_id = tasks[0]["_id"]

# Update the tags of the selected task
update_tasks([{"_id": task_id, "tags": ["срочно"]}])
print("Tags for task 'поехать в театр' have been changed to ['срочно'].")`,
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
