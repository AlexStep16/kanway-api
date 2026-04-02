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
mongo_filter_archived = {"$or": [{"is_deleted": True}, {"is_deleted_external": True}]}

targets = [
    {"title": "Вытереть пыль по комнатам", "resolved_id": None},
    {"title": "Кухня: плита, раковина, столешницы", "resolved_id": None}
]

for idx, item in enumerate(targets):
    # Search archived tasks by exact title using fuzzy search
    res = search_tasks(mongo_filter=mongo_filter_archived, search_query=item["title"], search_mode="fuzzy", limit=20)
    tasks = res.get("tasks", []) if isinstance(res, dict) else []
    # Filter exact name match if possible to reduce ambiguity
    exact_matches = [t for t in tasks if isinstance(t, dict) and t.get("name") == item["title"]]
    candidates = exact_matches if exact_matches else tasks

    if len(candidates) == 0:
        print(f"Не найдено архивных задач с названием: {item['title']}")
        continue
    if len(candidates) > 1:
        # resolve ambiguity for this specific title
        selected_ids = resolve_ambiguous(
            entity_type="task",
            ids=[t.get("_id") for t in candidates if t.get("_id")],
            min_select=1,
            max_select=1,
            id=f"ambig_{idx}"
        )
        if selected_ids and len(selected_ids) > 0:
            item["resolved_id"] = selected_ids[0]
    else:
        item["resolved_id"] = candidates[0].get("_id")

recover_ids = [item["resolved_id"] for item in targets if item["resolved_id"]]
if recover_ids:
    recover_tasks(ids=recover_ids)
    print(f"Восстановлено задач: {len(recover_ids)}")
else:
    print("Нет задач для восстановления.")`,
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
