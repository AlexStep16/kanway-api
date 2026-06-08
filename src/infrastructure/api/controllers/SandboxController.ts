import { ToolDispatcherService } from '@/application/ai/services/ToolDispatcherService.js'
import SuccessResponse from '@/application/services/SuccessResponse.js'
import { NextFunction, Request, Response } from 'express'

export default class SandboxController {
  protected toolDispatcherService: ToolDispatcherService

  constructor(toolDispatcherService: ToolDispatcherService) {
    this.toolDispatcherService = toolDispatcherService
  }

  public executeTool = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.user_id as string

      const result = await this.toolDispatcherService.dispatch({
        toolCall: req.body,
        userId,
        config: {},
      })

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public test = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const url = (process.env.PYTHON_SANDBOX_URL || 'http://localhost:8000') + '/execute'
      console.log(url)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `
board_id = "69e738a9bc647559a34999ea"

# Fetch all tasks on the active board
tasks_resp = search_tasks(mongo_filter={"board": board_id}, limit=200)
tasks = tasks_resp.get("items", [])

# Print essential task data for analysis
print({
    "board_id": board_id,
    "tasks_count": len(tasks),
    "tasks": [
        {
            "id": t.get("_id"),
            "name": t.get("name"),
            "column": t.get("column"),
            "is_completed": t.get("is_completed"),
            "tags": t.get("tags", []),
            "priority": t.get("priority"),
            "due_date": t.get("due_date"),
        }
        for t in tasks
    ],
})

# Identify completed tasks on the active board
completed_tasks = [t for t in tasks if t.get("is_completed") is True]

# If there are completed tasks, move them back to a working stage based on launch phase
# Heuristic:
# - Prefer columns whose names suggest active work stages
# - Avoid columns whose names suggest completion/archive
columns_resp = search_columns(mongo_filter={"board": board_id}, limit=100)
columns = columns_resp.get("items", [])

working_keywords = [
    "план", "backlog", "todo", "to do", "в работе", "работа", "разработка",
    "дизайн", "контент", "маркетинг", "запуск", "подготовка", "тест", "review"
]
completed_keywords = ["done", "готово", "completed", "заверш", "архив", "archive"]

working_columns = []
for c in columns:
    name = (c.get("name") or "").lower()
    if any(k in name for k in working_keywords) and not any(k in name for k in completed_keywords):
        working_columns.append(c)

# Fallback: if no obvious working column exists, use any non-completed column
if not working_columns:
    for c in columns:
        name = (c.get("name") or "").lower()
        if not any(k in name for k in completed_keywords):
            working_columns.append(c)

# If still ambiguous, ask user to choose the target column
target_column_id = None
if len(working_columns) == 1:
    target_column_id = working_columns[0].get("_id")
elif len(working_columns) > 1:
    selected = resolve_ambiguous(
        entity_type="column",
        ids=[c.get("_id") for c in working_columns],
        min_select=1,
        max_select=1,
        id=board_id,
    )
    target_column_id = selected[0] if selected else None

# Move completed tasks to the selected working column and mark them as not completed
if completed_tasks and target_column_id:
    updates = []
    for t in completed_tasks:
        updates.append({
            "_id": t.get("_id"),
            "column": target_column_id,
            "is_completed": False,
        })
    update_tasks(updates)

# Verify completed stage is empty after the move
tasks_after_resp = search_tasks(mongo_filter={"board": board_id, "is_completed": True}, limit=200)
remaining_completed = tasks_after_resp.get("items", [])

print({
    "moved_tasks_count": len(completed_tasks) if target_column_id else 0,
    "target_column_id": target_column_id,
    "remaining_completed_count": len(remaining_completed),
    "remaining_completed_tasks": [
        {
            "id": t.get("_id"),
            "name": t.get("name"),
            "column": t.get("column"),
        }
        for t in remaining_completed
    ],
})`,
          config: JSON.stringify({}),
          user_id: '69e735c8bea70b6721b5afe0',
          payload: {
            board_name: 'Контент‑план: Дизайн‑блог',
            board_workspace_id: '69b9753802918145c4e83227',
            columns: [
              {
                name: 'Идеи',
                tasks: [
                  { name: 'Как быстро улучшить читаемость веб‑страниц: лучшие шрифты и интервалы' },
                  { name: 'Трудности выбора цветовой палитры: практические рекомендации' },
                  {
                    name: 'Оптимизация графики для мобильных устройств: советы по размеру и формату',
                  },
                  { name: 'Как избежать выгорания при работе над большим дизайн‑проектом' },
                  { name: 'Эффективные методы получения обратной связи от клиентов' },
                ],
              },
              { name: 'В работе', tasks: [] },
              { name: 'Дизайн/Монтаж', tasks: [] },
              { name: 'Готово к публикации', tasks: [] },
            ],
          },
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
