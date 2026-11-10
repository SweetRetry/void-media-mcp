import { defineProject } from "vite-plus"

export default defineProject({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    name: "ui",
  },
})
