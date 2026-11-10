import { defineConfig } from "vite-plus"

/**
 * Workspace-wide lint, format and test settings for Vite+ (`vp lint`, `vp fmt`, `vp test`).
 * App build and dev settings live in each app's own vite.config.ts.
 */
export default defineConfig({
  fmt: {
    semi: false,
    printWidth: 100,
    trailingComma: "es5",
    sortPackageJson: true,
    ignorePatterns: [
      "**/routeTree.gen.ts",
      "**/db/migrations/**",
      "packages/ui/src/components/**",
      "pnpm-lock.yaml",
      ".agents/skills/void/**",
      ".agents/skills/sweet-mode/**",
    ],
  },
  lint: {
    plugins: ["typescript", "react", "jsx-a11y", "import"],
    jsPlugins: ["@shadcn/lint"],
    settings: {
      shadcn: {
        note: "Component appearance belongs to packages/ui variants (AGENTS.md › Architecture). Design rules are routed from DESIGN.md.",
        componentImports: ["^@workspace/ui/components"],
      },
    },
    rules: {
      // `const { node, ...props } = p` is how a prop is dropped before spreading the rest.
      "no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      "shadcn/no-restyle": [
        "error",
        {
          allow: ["layout"],
          contracts: [
            {
              pattern:
                "^(?:Card|CardHeader|CardContent|CardFooter|DialogContent|DialogHeader|DialogFooter|AlertDialogContent|AlertDialogHeader|AlertDialogFooter|SheetContent|SheetHeader|SheetFooter|DrawerContent|DrawerHeader|DrawerFooter|PopoverContent|HoverCardContent|TabsContent|AccordionContent|CollapsibleContent|ScrollArea|ResizablePanel|SidebarContent|SidebarHeader|SidebarFooter|SidebarGroup|SidebarGroupContent|FormItem|Field|FieldGroup|FieldSet|Alert)$",
              allow: ["layout", "spacing", "rounded"],
            },
            {
              pattern:
                "^(?:CardTitle|CardDescription|DialogTitle|DialogDescription|AlertDialogTitle|AlertDialogDescription|SheetTitle|SheetDescription|DrawerTitle|DrawerDescription|AlertTitle|AlertDescription|TableHead|TableCell|TableCaption|FormLabel|FormDescription|FieldLabel|FieldDescription|FieldLegend)$",
              allow: ["layout", "spacing", "typography"],
            },
          ],
        },
      ],
      "shadcn/no-raw-colors": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-arbitrary-values": ["error", { allow: ["layout"] }],
    },
    overrides: [
      {
        // The app's own component library, where appearance is defined rather than applied:
        // motion values drive inline styles, brand marks carry their colors, and chips size
        // their type off the container. Like packages/ui, it is exempt from the rules that
        // keep appearance out of call sites. `no-restyle` still applies, so it composes
        // packages/ui components by their variants like any other caller.
        files: ["apps/web/src/components/{agents,scroll-rail,ui}/**"],
        rules: {
          "shadcn/no-raw-colors": "off",
          "shadcn/no-inline-styles": "off",
          "shadcn/no-arbitrary-values": "off",
        },
      },
    ],
    ignorePatterns: [
      "packages/ui/src/components/**",
      "**/routeTree.gen.ts",
      "**/.void/**",
      ".agents/skills/sweet-mode/**",
    ],
  },
  test: {
    projects: ["apps/*", "packages/*"],
  },
})
