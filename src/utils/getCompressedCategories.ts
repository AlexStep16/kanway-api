import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'

interface CompressedCategory {
  id: string
  name: string
  boardName: string
}

export function getCompressedCategories(
  categories: ICategoryPopulated[],
): Array<CompressedCategory> {
  return categories.map((category) => ({
    id: category.id.toString(),
    name: category.name,
    boardName: category.board.name,
  }))
}
