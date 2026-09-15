import { AppError } from '@errors/AppError.js'
import { BoardService } from '@application/services/BoardService.js'
import { ColumnService } from '@application/services/ColumnService.js'
import { TaskService } from '@application/services/TaskService.js'
import { BoardDTO } from '@dtos/BoardDTO.js'
import { ColumnDTO } from '@dtos/ColumnDTO.js'
import { TaskDTO } from '@dtos/TaskDTO.js'
import { IUser } from '@entities/IUser.js'
import { IBoardPopulated } from '@interfaces/IBoardPopulated.js'
import removeMarkdown from 'remove-markdown'

export interface IYandexTrackerCredentials {
  token: string
  orgId: string
  // Cached after the first successful request so later calls skip the header detection round-trip
  resolvedIsCloudOrg?: boolean
}

export interface IYandexTrackerBoard {
  id: number
  name: string
}

export interface IYandexTrackerColumnStatus {
  id: string
  key: string
  display: string
}

export interface IYandexTrackerColumn {
  id: number
  name: string
  statuses: IYandexTrackerColumnStatus[]
}

export interface IYandexTrackerIssue {
  id: string
  key: string
  summary: string
  description: string | null
  status: { key: string } | null
  deadline: string | null
  priority: { key: string } | null
}

export class YandexTrackerService {
  private readonly baseUrl = 'https://api.tracker.yandex.net'
  private readonly perPage = 100

  // Статусы Yandex Tracker, которые считаются выполненными
  private readonly completedStatusKeys = new Set(['done'])

  // Маппинг приоритетов Yandex Tracker на приоритеты задач Kanway
  private readonly yandexPriorityToTaskPriority: Record<string, NonNullable<TaskDTO['priority']>> =
    {
      minimal: 'low',
      trivial: 'low',
      minor: 'low',
      normal: 'medium',
      important: 'medium',
      critical: 'high',
      blocker: 'high',
    }

  constructor(
    private readonly boardService: BoardService,
    private readonly columnService: ColumnService,
    private readonly taskService: TaskService,
  ) {}

  private _headers(
    credentials: IYandexTrackerCredentials,
    isCloudOrg: boolean,
  ): Record<string, string> {
    const orgHeaderName = isCloudOrg ? 'X-Cloud-Org-ID' : 'X-Org-ID'

    return {
      Authorization: `OAuth ${credentials.token}`,
      [orgHeaderName]: credentials.orgId,
      'Content-Type': 'application/json',
    }
  }

  private async _handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        throw new AppError('Неверный или просроченный токен Yandex Tracker', 401)
      }

      if (response.status === 403) {
        throw new AppError('Неверный идентификатор организации Yandex Tracker', 403)
      }

      throw new AppError(`Ошибка запроса к Yandex Tracker: ${response.statusText}`, 502)
    }

    return (await response.json()) as T
  }

  private async _fetchRaw(
    path: string,
    credentials: IYandexTrackerCredentials,
    isCloudOrg: boolean,
    init: RequestInit = {},
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: this._headers(credentials, isCloudOrg),
    })
  }

  // The org may belong to Yandex 360 (X-Org-ID) or Yandex Identity Hub (X-Cloud-Org-ID);
  // try the first header, and if it fails, fall back to the other one and remember the choice
  private async _fetchWithOrgFallback<T>(
    path: string,
    credentials: IYandexTrackerCredentials,
    init: RequestInit = {},
  ): Promise<T> {
    if (credentials.resolvedIsCloudOrg === undefined) {
      const primaryResponse = await this._fetchRaw(path, credentials, false, init)

      if (primaryResponse.ok) {
        credentials.resolvedIsCloudOrg = false

        return this._handleResponse<T>(primaryResponse)
      }

      const cloudResponse = await this._fetchRaw(path, credentials, true, init)

      credentials.resolvedIsCloudOrg = true

      return this._handleResponse<T>(cloudResponse)
    }

    const response = await this._fetchRaw(path, credentials, credentials.resolvedIsCloudOrg, init)

    return this._handleResponse<T>(response)
  }

  private async _get<T>(path: string, credentials: IYandexTrackerCredentials): Promise<T> {
    return this._fetchWithOrgFallback<T>(path, credentials)
  }

  private async _post<T>(
    path: string,
    body: unknown,
    credentials: IYandexTrackerCredentials,
  ): Promise<T> {
    return this._fetchWithOrgFallback<T>(path, credentials, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  public async exchangeCode(code: string, codeVerifier: string): Promise<string> {
    const params = new URLSearchParams()
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('client_id', process.env.YANDEX_CLIENT_ID || '')
    params.append('client_secret', process.env.YANDEX_CLIENT_SECRET || '')
    params.append('code_verifier', codeVerifier)
    params.append('redirect_uri', 'https://kanway.ru/yandex/suggest/token')

    const response = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    const data = (await response.json()) as { access_token?: string }

    if (!data.access_token) {
      throw new AppError('Не удалось авторизоваться в Yandex Tracker', 400)
    }

    return data.access_token
  }

  public async getBoards(credentials: IYandexTrackerCredentials): Promise<IYandexTrackerBoard[]> {
    return this._get<IYandexTrackerBoard[]>('/v3/boards', credentials)
  }

  private async _getBoardColumns(
    boardId: number,
    credentials: IYandexTrackerCredentials,
  ): Promise<IYandexTrackerColumn[]> {
    return this._get<IYandexTrackerColumn[]>(`/v3/boards/${boardId}/columns`, credentials)
  }

  private async _getBoardIssues(
    boardId: number,
    credentials: IYandexTrackerCredentials,
  ): Promise<IYandexTrackerIssue[]> {
    const issues: IYandexTrackerIssue[] = []
    let page = 1

    // Board issues are paginated; keep requesting pages until a partial (last) page is returned
    for (;;) {
      const pageIssues = await this._post<IYandexTrackerIssue[]>(
        `/v3/issues/_search?perPage=${this.perPage}&page=${page}&fields=summary,description,status,deadline,priority`,
        {
          // Используем поисковый запрос Трекера по полю Boards
          query: `Boards: ${boardId}`,
        },
        credentials,
      )

      issues.push(...pageIssues)

      if (pageIssues.length < this.perPage) break

      page += 1
    }

    return issues
  }

  private _mapIssueToTaskDTO(issue: IYandexTrackerIssue, columnId: string): TaskDTO {
    const statusKey = issue.status?.key
    const priorityKey = issue.priority?.key

    return {
      name: (issue.summary || 'Без названия').slice(0, 100),
      description: issue.description
        ? removeMarkdown(issue.description, { stripListLeaders: false }).slice(0, 16384)
        : undefined,
      dueDate: issue.deadline ? issue.deadline.slice(0, 10) : undefined,
      isCompleted: statusKey ? this.completedStatusKeys.has(statusKey) : undefined,
      priority: priorityKey ? this.yandexPriorityToTaskPriority[priorityKey] : undefined,
      columnId,
    }
  }

  private async _createBoardFromTrackerData(
    board: IYandexTrackerBoard,
    credentials: IYandexTrackerCredentials,
    workspaceId: string,
    user: IUser,
  ): Promise<IBoardPopulated> {
    const [columns, issues] = await Promise.all([
      this._getBoardColumns(board.id, credentials),
      this._getBoardIssues(board.id, credentials),
    ])

    const boardDTO: BoardDTO = {
      name: (board.name || 'Импортированная доска').slice(0, 100),
      workspaceId,
    }

    const boardResult = await this.boardService.create(boardDTO, user)
    const createdBoard = boardResult.data[0]

    for (const column of columns) {
      const columnDTO: ColumnDTO = {
        name: (column.name || 'Без названия').slice(0, 100),
        boardId: createdBoard.id.toString(),
      }

      const columnResult = await this.columnService.create(columnDTO, user)
      const createdColumn = columnResult.data[0]

      const statusKeys = new Set(column.statuses.map((status) => status.key))
      const columnIssues = issues.filter(
        (issue) => issue.status && statusKeys.has(issue.status.key),
      )

      if (columnIssues.length > 0) {
        const taskDTOs = columnIssues.map((issue) =>
          this._mapIssueToTaskDTO(issue, createdColumn.id.toString()),
        )

        await this.taskService.createMany(taskDTOs, user)
      }
    }

    return createdBoard
  }

  public async importBoards(
    boardIds: number[],
    credentials: IYandexTrackerCredentials,
    workspaceId: string,
    user: IUser,
  ): Promise<IBoardPopulated[]> {
    const boards = await this.getBoards(credentials)
    const boardsById = new Map(boards.map((board) => [board.id, board]))
    const importedBoards: IBoardPopulated[] = []

    // Imported sequentially so each board goes through its own limit checks/transaction
    for (const boardId of boardIds) {
      const board = boardsById.get(boardId)

      if (!board) {
        throw new AppError(`Доска Yandex Tracker с идентификатором ${boardId} не найдена`, 404)
      }

      const importedBoard = await this._createBoardFromTrackerData(
        board,
        credentials,
        workspaceId,
        user,
      )

      importedBoards.push(importedBoard)
    }

    return importedBoards
  }

  public async importAllBoards(
    credentials: IYandexTrackerCredentials,
    workspaceId: string,
    user: IUser,
  ): Promise<IBoardPopulated[]> {
    const boards = await this.getBoards(credentials)
    const importedBoards: IBoardPopulated[] = []

    for (const board of boards) {
      const importedBoard = await this._createBoardFromTrackerData(
        board,
        credentials,
        workspaceId,
        user,
      )

      importedBoards.push(importedBoard)
    }

    return importedBoards
  }
}
