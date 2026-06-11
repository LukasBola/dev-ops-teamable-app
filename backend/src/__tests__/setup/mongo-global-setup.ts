import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import type { ProvidedContext } from 'vitest'

let container: StartedMongoDBContainer

type SetupContext = {
  provide: <T extends keyof ProvidedContext & string>(key: T, value: ProvidedContext[T]) => void
}

export default async function setup({ provide }: SetupContext) {
  container = await new MongoDBContainer('mongo:7').start()
  // Append directConnection=true so Mongoose bypasses replica-set topology
  // discovery (testcontainers/mongodb enables RS mode; the RS member advertises
  // its internal Docker hostname, which is unreachable from the host).
  const uri = `${container.getConnectionString()}?directConnection=true`
  provide('MONGODB_URI', uri)

  return async () => {
    await container.stop()
  }
}

declare module 'vitest' {
  interface ProvidedContext {
    MONGODB_URI: string
  }
}
