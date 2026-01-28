import { EditCategoriesDTO } from '@application/ai/tools/toolSchemes.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { CategoryService } from '../../services/CategoryService.ts'
import { CategoryEditDTO } from '../../dtos/CategoryEditDTO.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'

export class CategoryCommandAdapterService {
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected vectorSearchService: VectorSearchService
  protected aiSemanticService: AISemanticService

  constructor(
    categoryService: CategoryService,
    boardService: BoardService,
    vectorSearchService: VectorSearchService,
    aiSemanticService: AISemanticService,
  ) {
    this.categoryService = categoryService
    this.boardService = boardService
    this.vectorSearchService = vectorSearchService
    this.aiSemanticService = aiSemanticService
  }

  public async translateAndExecute(
    categoryIds: string[],
    changes: EditCategoriesDTO['changes'],
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    const categoriesToUpdate: CategoryEditDTO[] = []

    const existingCategories = await this.categoryService.getByCriteria(
      { ids: categoryIds },
      user.id,
      session,
    )

    for (const category of existingCategories) {
      const updatedCategory = {
        id: category.id.toString(),
      } as CategoryEditDTO

      if (typeof changes.boardId !== 'undefined' && typeof changes.boardId === 'string') {
        updatedCategory.boardId = changes.boardId

        const boardCount = await this.boardService.getCount(
          { id: changes.boardId },
          user.id,
          session,
        )

        if (boardCount === 0) {
          throw new NotFoundError(`Board with id ${changes.boardId} not found`)
        }
      }

      if (typeof changes.order !== 'undefined') {
        if (typeof changes.order === 'string') updatedCategory.order = parseInt(changes.order, 10)
        else if (typeof changes.order === 'number') updatedCategory.order = changes.order
      }

      categoriesToUpdate.push(updatedCategory)
    }

    if (categoriesToUpdate.length === 0)
      return {
        data: [],
        logId: null,
      }

    if (typeof changes.name !== 'undefined') {
      let updatedNames: { id: Types.ObjectId; name: string }[] = []

      if (changes.name.set) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          existingCategories,
          String(changes.name.set),
          'set',
        )
      }
      if (changes.name.append) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingCategories,
          String(changes.name.append),
          'append',
        )
      }
      if (changes.name.prepend) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingCategories,
          String(changes.name.prepend),
          'prepend',
        )
      }
      if (changes.name.replace_part) {
        updatedNames = await this.aiSemanticService.buildNamesForEntities(
          updatedNames.length > 0 ? updatedNames : existingCategories,
          String(changes.name.replace_part.replace_with),
          'replace',
          String(changes.name.replace_part.find),
        )
      }

      for (const updatedCategory of categoriesToUpdate) {
        const updatedNameData = updatedNames.find((data) => data.id.equals(updatedCategory.id))

        if (updatedNameData) {
          updatedCategory.name = updatedNameData.name
        }
      }
    }

    return await this.categoryService.editMany(categoriesToUpdate, user, session)
  }
}
