import dayjs from 'dayjs'
import { AppError } from '@errors/AppError.js'
import { BoardService } from '@application/services/BoardService.js'
import { ColumnService } from '@application/services/ColumnService.js'
import { TaskService } from '@application/services/TaskService.js'
import { BoardDTO } from '@dtos/BoardDTO.js'
import { ColumnDTO } from '@dtos/ColumnDTO.js'
import { TaskDTO } from '@dtos/TaskDTO.js'
import { IUser } from '@entities/IUser.js'
import { IBoardPopulated } from '@interfaces/IBoardPopulated.js'
import { TASK_COLORS_TITLES } from '@constants/TASK_COLORS.js'

// Trello label colors mapped to the closest task color available in the app
const TRELLO_LABEL_COLOR_MAP: Record<string, (typeof TASK_COLORS_TITLES)[number]> = {
  green: 'green',
  yellow: 'yellow',
  orange: 'orange',
  red: 'red',
  purple: 'purple',
  blue: 'blue',
  sky: 'blue',
  lime: 'lime',
  pink: 'pink',
  black: 'gray',
  grey: 'gray',
}

export interface ITrelloBoard {
  id: string
  name: string
  closed: boolean
}

export interface ITrelloLabel {
  id: string
  name: string
  color: string | null
}

export interface ITrelloList {
  id: string
  name: string
  closed: boolean
  pos: number
}

export interface ITrelloCard {
  id: string
  name: string
  desc: string
  idList: string
  due: string | null
  dueComplete: boolean
  closed: boolean
  labels: ITrelloLabel[]
  pos: number
}

export interface ITrelloBoardFull extends ITrelloBoard {
  lists: ITrelloList[]
  cards: ITrelloCard[]
}

export class TrelloService {
  private readonly baseUrl = 'https://api.kanway-proxy.org/trello'
  private readonly apiKey = process.env.TRELLO_API_KEY

  constructor(
    private readonly boardService: BoardService,
    private readonly columnService: ColumnService,
    private readonly taskService: TaskService,
  ) {}

  private async _request<T>(
    path: string,
    token: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    if (!this.apiKey) {
      throw new AppError('Не настроен ключ Trello API', 500)
    }

    const url = new URL(`${this.baseUrl}${path}`)
    url.searchParams.set('key', this.apiKey)
    url.searchParams.set('token', token)

    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value)
    }

    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AppError('Неверный или просроченный токен Trello', 401)
      }

      throw new AppError(`Ошибка запроса к Trello: ${response.statusText}`, 502)
    }

    return (await response.json()) as T
  }

  public async getBoards(token: string): Promise<ITrelloBoard[]> {
    return this._request<ITrelloBoard[]>('/1/members/me/boards', token, {
      fields: 'name,closed',
      filter: 'open',
    })
  }

  private async _getBoardFull(boardId: string, token: string): Promise<ITrelloBoardFull> {
    return this._request<ITrelloBoardFull>(`/1/boards/${boardId}`, token, {
      fields: 'name,closed',
      lists: 'open',
      list_fields: 'name,closed',
      cards: 'open',
      card_fields: 'name,desc,idList,due,dueComplete,closed,labels,pos',
    })
  }

  private _mapCardToTaskDTO(card: ITrelloCard, columnId: string): TaskDTO {
    const label = card.labels.find((l) => l.color && TRELLO_LABEL_COLOR_MAP[l.color])
    const due = card.due ? dayjs(card.due) : null

    return {
      name: (card.name || 'Без названия').slice(0, 100),
      description: card.desc ? card.desc.slice(0, 16384) : undefined,
      dueDate: due ? due.format('YYYY-MM-DD') : undefined,
      dueHours: due ? due.hour() : undefined,
      dueMinutes: due ? due.minute() : undefined,
      isCompleted: card.dueComplete,
      columnId,
      color: label
        ? { value: TRELLO_LABEL_COLOR_MAP[label.color as string], tone: 'medium' }
        : undefined,
    }
  }

  public async importBoard(
    boardId: string,
    token: string,
    workspaceId: string,
    user: IUser,
  ): Promise<IBoardPopulated> {
    const trelloBoard = await this._getBoardFull(boardId, token)

    const boardDTO: BoardDTO = {
      name: (trelloBoard.name || 'Импортированная доска').slice(0, 100),
      workspaceId,
    }

    const boardResult = await this.boardService.create(boardDTO, user)
    const createdBoard = boardResult.data[0]

    const openLists = trelloBoard.lists.filter((list) => !list.closed).sort((a, b) => a.pos - b.pos)
    const taskDTOs: TaskDTO[] = []

    for (const list of openLists) {
      const columnDTO: ColumnDTO = {
        name: (list.name || 'Без названия').slice(0, 100),
        boardId: createdBoard.id.toString(),
      }

      const columnResult = await this.columnService.create(columnDTO, user)
      const createdColumn = columnResult.data[0]

      const listCards = trelloBoard.cards
        .filter((card) => card.idList === list.id && !card.closed)
        .sort((a, b) => a.pos - b.pos)

      for (const card of listCards) {
        taskDTOs.push(this._mapCardToTaskDTO(card, createdColumn.id.toString()))
      }
    }

    if (taskDTOs.length > 0) {
      await this.taskService.createMany(taskDTOs, user)
    }

    return createdBoard
  }

  public async importAllBoards(
    token: string,
    workspaceId: string,
    user: IUser,
  ): Promise<IBoardPopulated[]> {
    const boards = await this.getBoards(token)

    return this.importBoards(
      boards.map((board) => board.id),
      token,
      workspaceId,
      user,
    )
  }

  public async importBoards(
    boardIds: string[],
    token: string,
    workspaceId: string,
    user: IUser,
  ): Promise<IBoardPopulated[]> {
    const importedBoards: IBoardPopulated[] = []

    // Imported sequentially so each board goes through its own limit checks/transaction
    for (const boardId of boardIds) {
      const importedBoard = await this.importBoard(boardId, token, workspaceId, user)

      importedBoards.push(importedBoard)
    }

    return importedBoards
  }

  public getApiKey(): string | undefined {
    return this.apiKey
  }
}
