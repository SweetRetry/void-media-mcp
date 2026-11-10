import { defineScheduled } from "void"

import { advanceDue } from "../src/server/generation/tasks.server"

/** Moves open tasks along every minute, so a video finishes even when nobody polls it. */
export const cron = "* * * * *"

export default defineScheduled(async () => {
  await advanceDue()
})
