import { ITokenDetails } from './ITokenDetails.js'

export interface ITokenUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  input_token_details?: ITokenDetails
  output_token_details?: ITokenDetails
}
