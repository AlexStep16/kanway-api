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
board_id = "69b9757502918145c4e83247"

# Поиск категории "спорт"
sport_candidates = search_categories(
    search_query="спорт",
    mongo_filter={"board": board_id}
)

if not sport_candidates:
    print("Категория «спорт» не найдена на доске.")
else:
    # Получаем ID категории, учитывая возможный тип элемента
    if len(sport_candidates) == 1:
        candidate = sport_candidates[0]
        sport_id = candidate["_id"] if isinstance(candidate, dict) else candidate
    else:
        sport_ids = [
            c["_id"] if isinstance(c, dict) else c
            for c in sport_candidates
        ]
        resolved = resolve_ambiguous(
            entity_type="category",
            ids=sport_ids,
            min_select=1,
            max_select=1,
            id="move_category_sport"
        )
        sport_id = resolved[0]

    # Поиск категории "бэклог"
    backlog_candidates = search_categories(
        search_query="бэклог",
        mongo_filter={"board": board_id}
    )

    if not backlog_candidates:
        print("Категория «бэклог» не найдена на доске.")
    else:
        if len(backlog_candidates) == 1:
            candidate = backlog_candidates[0]
            backlog_id = candidate["_id"] if isinstance(candidate, dict) else candidate
        else:
            backlog_ids = [
                c["_id"] if isinstance(c, dict) else c
                for c in backlog_candidates
            ]
            resolved = resolve_ambiguous(
                entity_type="category",
                ids=backlog_ids,
                min_select=1,
                max_select=1,
                id="move_category_backlog"
            )
            backlog_id = resolved[0]

        # Перемещение категории "спорт" перед "бэклог"
        moved_category = move_category(
            id=sport_id,
            before_category_id=backlog_id,
            after_category_id=None,
            new_board_id=None
        )
        print("Категория перемещена:", moved_category)`,
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
