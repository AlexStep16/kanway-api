import AuthController from '@controllers/AuthController.ts'
import { AuthService } from '@application/services/AuthService.ts'
import { UserService } from '@application/services/UserService.ts'
import UserRepository from '@repositories/UserRepository.ts'
import { EmailService } from '@infrastructure/services/EmailService.ts'
import TokenRepository from '@repositories/TokenRepository.ts'
import { TokenService } from '@application/services/TokenService.ts'
import WorkspaceController from '@controllers/WorkspaceController.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import WorkspaceRepository from '@repositories/WorkspaceRepository.ts'
import { EmbeddingService } from '@infrastructure/services/EmbeddingService.ts'
import { OperationLogService } from '@application/services/OperationLogService.ts'
import OperationLogRepository from '@repositories/OperationLogRepository.ts'
import { ReorderService } from '@application/services/ReorderService.ts'
import { BoardService } from '@application/services/BoardService.ts'
import BoardRepository from '@repositories/BoardRepository.ts'
import BoardController from '@controllers/BoardController.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import CategoryRepository from '@repositories/CategoryRepository.ts'
import CategoryController from '@controllers/CategoryController.ts'
import TaskRepository from '@application/repositories/TaskRepository.ts'
import { TaskService } from '@application/services/TaskService.ts'
import TaskController from '../api/controllers/TaskController.ts'

export function initializeDependencies() {
  const userRepository = new UserRepository()
  const tokenRepository = new TokenRepository()
  const workspaceRepository = new WorkspaceRepository()
  const operationLogRepository = new OperationLogRepository()
  const boardRepository = new BoardRepository()
  const categoryRepository = new CategoryRepository()
  const taskRepository = new TaskRepository()

  /* AUTH SERVICES START */
  const tokenService = new TokenService(tokenRepository)
  const userService = new UserService(userRepository)
  const emailService = new EmailService(tokenRepository, tokenService)
  const authService = new AuthService(userService, emailService, tokenService)
  /* AUTH SERVICES END */

  /* BASE SERVICES START */
  const embeddingService = new EmbeddingService()
  const operationLogService = new OperationLogService(operationLogRepository)
  /* BASE SERVICES END */

  /* MOCK SERVICES START */
  const mockCategoryService = {} as CategoryService
  const mockBoardService = {} as BoardService
  /* MOCK SERVICES END */

  /* TASK SERVICES START */
  const taskReorderService = new ReorderService(taskRepository, operationLogService)
  const taskService = new TaskService(
    taskRepository,
    embeddingService,
    operationLogService,
    taskReorderService,
    mockCategoryService
  )
  /* TASK SERVICES END */

  /* CATEGORY SERVICES START */
  const categoryReorderService = new ReorderService(categoryRepository, operationLogService)
  const categoryService = new CategoryService(
    categoryRepository,
    embeddingService,
    operationLogService,
    categoryReorderService,
    mockBoardService,
    taskService
  )
  /* CATEGORY SERVICES END */

  /* BOARD SERVICES START */
  const boardReorderService = new ReorderService(boardRepository, operationLogService)
  const boardService = new BoardService(
    boardRepository,
    embeddingService,
    operationLogService,
    boardReorderService,
    categoryService,
    taskService
  )
  /* BOARD SERVICES END */

  Object.assign(mockCategoryService, categoryService)
  Object.assign(mockBoardService, boardService)

  /* WORKSPACE SERVICES START */
  const workspaceReorderService = new ReorderService(workspaceRepository, operationLogService)
  const workspaceService = new WorkspaceService(
    workspaceRepository,
    embeddingService,
    operationLogService,
    workspaceReorderService,
    boardService
  )
  /* WORKSPACE SERVICES END */

  const authController = new AuthController(authService)
  const workspaceController = new WorkspaceController(workspaceService)
  const boardController = new BoardController(boardService)
  const categoryController = new CategoryController(categoryService)
  const taskController = new TaskController(taskService)

  return {
    services: {
      authService,
      userService,
      emailService,
      tokenService,
      workspaceService,
      categoryService,
      boardService,
      taskService,
    },
    controllers: {
      authController,
      workspaceController,
      boardController,
      categoryController,
      taskController,
    },
  }
}
