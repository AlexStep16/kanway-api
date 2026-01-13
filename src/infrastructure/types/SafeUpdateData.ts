type ImmutableKeys = 'id' | '_id' | 'createdAt' | 'updatedAt'

export type SafeUpdateData<T> = {
  [P in keyof Omit<T, ImmutableKeys>]?: undefined extends T[P] ? T[P] | null : T[P]
}
