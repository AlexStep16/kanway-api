import { IColumnPopulated } from '@/application/interfaces/IColumnPopulated.js'

interface CompressedColumn {
  id: string
  name: string
  boardName: string
}

export function getCompressedColumns(columns: IColumnPopulated[]): Array<CompressedColumn> {
  return columns.map((column) => ({
    id: column.id.toString(),
    name: column.name,
    boardName: column.board.name,
  }))
}
