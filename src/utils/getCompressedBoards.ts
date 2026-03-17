import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'

interface CompressedBoard {
  id: string
  name: string
  workspaceName: string
}

export function getCompressedBoards(boards: IBoardPopulated[]): Array<CompressedBoard> {
  return boards.map((board) => ({
    id: board.id.toString(),
    name: board.name,
    workspaceName: board.workspace.name,
  }))
}
