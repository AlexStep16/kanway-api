import { IBoard } from '@entities/IBoard.ts'
import { ICategoryServerResponse } from '@entities/ICategoryServerResponse.ts'
import { ITaskServerResponse } from '@entities/ITaskServerResponse.ts'

export interface ClonedBoardsResult {
  boards: IBoard[]
  categories: ICategoryServerResponse[]
  tasks: ITaskServerResponse[]
}
