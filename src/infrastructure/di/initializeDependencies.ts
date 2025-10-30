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
import BoardRepository from '@/application/repositories/BoardRepository.ts'
import BoardController from '@controllers/BoardController.ts'

export function initializeDependencies() {
  const userRepository = new UserRepository()
  const tokenRepository = new TokenRepository()
  const workspaceRepository = new WorkspaceRepository()
  const operationLogRepository = new OperationLogRepository()
  const boardRepository = new BoardRepository()

  /* AUTH SERVICES START */
  const tokenService = new TokenService(tokenRepository)
  const userService = new UserService(userRepository)
  const emailService = new EmailService(tokenRepository, tokenService)
  const authService = new AuthService(userService, emailService, tokenService)
  /* AUTH SERVICES END */

  /* WORKSPACE SERVICES START */
  const embeddingService = new EmbeddingService()
  const operationLogService = new OperationLogService(operationLogRepository)
  const workspaceReorderService = new ReorderService(workspaceRepository, operationLogService)
  const workspaceService = new WorkspaceService(
    workspaceRepository,
    embeddingService,
    operationLogService,
    workspaceReorderService
  )
  /* WORKSPACE SERVICES END */

  /* BOARD SERVICES START */
  const boardReorderService = new ReorderService(boardRepository, operationLogService)
  const boardService = new BoardService(
    boardRepository,
    embeddingService,
    operationLogService,
    boardReorderService
  )
  /* BOARD SERVICES END */

  const authController = new AuthController(authService)
  const workspaceController = new WorkspaceController(workspaceService)
  const boardController = new BoardController(boardService)

  return {
    services: {
      authService,
      userService,
      emailService,
      tokenService,
      workspaceService,
      boardService,
    },
    controllers: { authController, workspaceController, boardController },
  }
}
