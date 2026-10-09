import type { NuggitApi } from '../shared/types'

declare global {
  interface Window {
    api: NuggitApi
  }
}

export {}
