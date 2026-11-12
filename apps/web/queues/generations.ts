import { defineQueue } from "void"

import { startTask } from "../src/server/generation/tasks.server"

/**
 * Sends each queued task to its provider. A synchronous provider holds the request open for minutes,
 * so the call runs here, where nobody can hang up on it, instead of inside the caller's request.
 */
export const maxBatchSize = 1

export default defineQueue<{ taskId: string }>(async (batch) => {
  for (const message of batch.messages) await startTask(message.body.taskId)
})

// The app's own tsconfig `paths` replace the generated ones, so the queue map is declared here.
declare module "void/queues" {
  interface QueueMap {
    generations: Queue<{ taskId: string }>
  }
}
