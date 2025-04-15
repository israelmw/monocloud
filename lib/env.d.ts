declare namespace NodeJS {
  interface ProcessEnv {
    GITHUB_TOKEN: string
    OPENAI_API_KEY: string
    KV_URL?: string
    KV_REST_API_URL?: string
    KV_REST_API_TOKEN?: string
    KV_REST_API_READ_ONLY_TOKEN?: string
    UPSTASH_REDIS_REST_URL?: string
    UPSTASH_REDIS_REST_TOKEN?: string
    ADMIN_API_KEY?: string
  }
}
