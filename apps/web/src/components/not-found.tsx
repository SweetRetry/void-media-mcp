import { Link } from "@tanstack/react-router"

export function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-4xl font-semibold">This page isn't here</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Check the address, or start from the home page.
      </p>
      <Link to="/" className="link mt-4 inline-block text-sm text-primary">
        Go home
      </Link>
    </main>
  )
}
