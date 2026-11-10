import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { voidPlugin } from "void"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // voidPlugin wraps @cloudflare/vite-plugin and must come before tanstackStart. Every page is
  // dynamic (it needs a session), so nothing is prerendered.
  plugins: [voidPlugin(), tanstackStart(), react(), tailwindcss()],
})
