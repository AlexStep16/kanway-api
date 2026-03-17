import { CategoryService } from '@application/services/CategoryService.ts'
import { ClientSession, Types } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AISemanticService } from '@application/services/AISemanticService.ts'
import { IUser } from '@domain/entities/IUser.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'
import { StringModificationDTO } from '../tools/schemes/baseSchemes.ts'
import { NotFoundError } from '@/domain/errors/NotFound.ts'
import { BoardService } from '@/application/services/BoardService.ts'

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
  private _getTransformedCategoriesForStringModification(
    categories: ICategoryPopulated[],
    field: 'name',
  ): { id: Types.ObjectId; text: string }[] {
    return categories.map((category) => ({
      id: category.id,
      text: category[field] || '',
    }))
  }

  public async translateEditStringAndExecute(
    categoryIds: string[],
    dto: StringModificationDTO,
    field: 'name',
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    if (typeof dto === 'undefined' || dto === null || Object.keys(dto).length === 0) {
      return {
        data: [],
        logId: null,
      }
    }

    const categoriesToUpdate: CategoryEditDTO[] = []

    const existingCategories = await this.categoryService.getByCriteria(
      { ids: categoryIds },
      user.id,
      session,
    )
    const transformedCategories = this._getTransformedCategoriesForStringModification(
      existingCategories,
      field,
    )

    let updatedTexts: { id: Types.ObjectId; text: string }[] = []

    if (dto.set) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        transformedCategories,
        String(dto.set),
        'set',
      )
    }
    if (dto.append) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedCategories,
        String(dto.append),
        'append',
      )
    }
    if (dto.prepend) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedCategories,
        String(dto.prepend),
        'prepend',
      )
    }
    if (dto.replace_part) {
      updatedTexts = this.aiSemanticService.buildTextForEntities(
        updatedTexts.length > 0 ? updatedTexts : transformedCategories,
        String(dto.replace_part.replace_with),
        'replace',
        String(dto.replace_part.find),
      )
    }

    categoriesToUpdate.push(
      ...updatedTexts.map((data) => ({ id: data.id.toString(), [field]: data.text })),
    )

    for (const updatedCategory of categoriesToUpdate) {
      const updatedTextData = updatedTexts.find((data) => data.id.equals(updatedCategory.id))

      if (updatedTextData) {
        updatedCategory[field] = updatedTextData.text
      }
    }

    return await this.categoryService.editMany(categoriesToUpdate, user, session)
  }

  public async translateEditBoardAndExecute(
    categoryIds: string[],
    boardId: string,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<ICategoryPopulated[]>> {
    if (!boardId) {
      return {
        data: [],
        logId: null,
      }
    }

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

      updatedCategory.boardId = boardId

      const boardCount = await this.boardService.getCount({ id: boardId }, user.id, session)

      if (boardCount === 0) {
        throw new NotFoundError(`Board with id ${boardId} not found`)
      }

      categoriesToUpdate.push(updatedCategory)
    }

    return await this.categoryService.editMany(categoriesToUpdate, user, session)
  }
}
