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
      const config = req.body.config as Record<string, any>

      const result = await this.toolDispatcherService.dispatch({
        toolCall: req.body,
        userId,
        config,
      })

      return res.status(200).json(new SuccessResponse(result))
    } catch (error) {
      next(error)
    }
  }

  public test = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const url = (process.env.PYTHON_SANDBOX_URL || 'http://localhost:8000') + '/execute'
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `
# -*- coding: utf-8 -*-

# Доступные глобальные переменные:
# payload – словарь, переданный Планировщику с описанием создаваемой доски,
#           категорий и задач.

# -------------------- 1. Получаем данные из payload --------------------
board_name = payload.get("board_name")
board_workspace_id = payload.get("board_workspace_id")
categories_payload = payload.get("categories", [])

# -------------------- 2. Создаём доску --------------------
board_payload = [
    {
        "name": board_name,
        "workspace": board_workspace_id,
        "is_favorite": False,          # у доски действительно есть поле is_favorite
    }
]

board_ids = create_boards(board_payload)
board_id = board_ids[0]  # одна доска

print(f"✅ Создана доска «{board_name}» (ID: {board_id})")

# -------------------- 3. Создаём категории --------------------
category_payloads = []
category_names = []          # сохраняем порядок, чтобы сопоставить ID позже
for cat in categories_payload:
    category_payloads.append(
        {
            "name": cat["name"],
            "board": board_id,
            "workspace": board_workspace_id,
            # поле is_favorite в категории не поддерживается – его убираем
        }
    )
    category_names.append(cat["name"])

category_ids = create_categories(category_payloads)

# Сопоставляем имена категорий с их ID
category_map = dict(zip(category_names, category_ids))

for name, cid in category_map.items():
    print(f"🔖 Категория «{name}» создана (ID: {cid})")

# -------------------- 4. Создаём задачи --------------------
task_payloads = []
task_info = []   # [(name, category_name)]

for cat in categories_payload:
    cat_name = cat["name"]
    cat_id = category_map[cat_name]
    for task in cat.get("tasks", []):
        task_name = task["name"]
        task_payloads.append(
            {
                "name": task_name,
                "category": cat_id,
                "board": board_id,
                "workspace": board_workspace_id,
                "is_completed": False,
            }
        )
        task_info.append((task_name, cat_name))

if task_payloads:
    task_ids = create_tasks(task_payloads)
else:
    task_ids = []

# Выводим информацию о созданных задачах
for (t_name, c_name), t_id in zip(task_info, task_ids):
    print(f"✅ Задача «{t_name}» в категории «{c_name}» (ID: {t_id})")`,
          config: {},
          user_id: '67da84f0a2e3729760781559',
          payload: {
            board_name: 'Контент‑план: Дизайн‑блог',
            board_workspace_id: '69b9753802918145c4e83227',
            categories: [
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
