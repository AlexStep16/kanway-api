import { AiConfirmationTypeEnum } from '@domain/enums/AiConfirmationTypeEnum.ts'
import { getConfirmationDestructiveConfig } from '@application/ai/configs/getConfirmationDestructiveConfig.ts'
import { ConfirmationContextConfig } from '@/application/ai/interfaces/ConfirmationContextConfig.ts'
import { getConfirmationGeneralConfig } from '@application/ai/configs/getConfirmationGeneralConfig.ts'
import { ContextExternalFetchService } from '@application/ai/services/ContextExternalFetchService.ts'

export function getUserConfirmConfig(
  confirmationType: AiConfirmationTypeEnum,
  contextExternalFetchService: ContextExternalFetchService,
) {
  let confirmationConfig: Record<string, ConfirmationContextConfig> = {}

  if (confirmationType === AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE) {
    confirmationConfig = getConfirmationDestructiveConfig(contextExternalFetchService)
  } else if (confirmationType === AiConfirmationTypeEnum.ALWAYS) {
    confirmationConfig = Object.assign(
      getConfirmationGeneralConfig(contextExternalFetchService),
      getConfirmationDestructiveConfig(contextExternalFetchService),
    )
  }
  return confirmationConfig
}
