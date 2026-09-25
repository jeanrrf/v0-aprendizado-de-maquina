export interface NimParameters {
  stream: boolean
  temperature: number
  top_p: number
  max_tokens: number
  frequency_penalty: number
  presence_penalty: number
}

export const DEFAULT_NIM_PARAMS: NimParameters = {
  stream: true,
  temperature: 0.7,
  top_p: 0.9,
  max_tokens: 2048,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
}
