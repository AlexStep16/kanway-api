import AuthController from '@controllers/AuthController.ts'
import { AuthService } from '@application/services/AuthService.ts'
import { UserService } from '@application/services/UserService.ts'
import UserRepository from '@repositories/UserRepository.ts'
import { EmailService } from '@infrastructure/services/EmailService.ts'
import TokenRepository from '@repositories/TokenRepository.ts'
import { TokenService } from '@application/services/TokenService.ts'

export function initializeDependencies() {
  const userRepository = new UserRepository()
  const tokenRepository = new TokenRepository()

  const tokenService = new TokenService(tokenRepository)
  const userService = new UserService(userRepository)
  const emailService = new EmailService(tokenRepository, tokenService)
  const authService = new AuthService(userService, emailService, tokenService)
  const authController = new AuthController(authService)

  return {
    services: { authService, userService, emailService, tokenService },
    controllers: { authController },
  }
}
