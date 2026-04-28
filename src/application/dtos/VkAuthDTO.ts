export interface VkAuthDTO {
  code: string
  state: string
  codeVerifier: string
  timezone: string
  deviceId?: string
}
