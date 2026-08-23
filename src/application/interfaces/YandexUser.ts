export interface YandexUser {
  id: string
  login: string
  client_id: string
  display_name: string
  is_avatar_empty: boolean
  default_avatar_id?: string
  real_name: string
  first_name: string
  last_name: string
  sex: string
  default_email?: string
  emails: string[]
  psuid: string
}
