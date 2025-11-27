export interface IUndoResponse<TResponse> {
  delete?: TResponse
  create?: TResponse
  update?: TResponse
}
