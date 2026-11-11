# Midjourney prompt guide

Checked 2026-11-11 against the official Midjourney docs. Follow this guide over what you remember about Midjourney: parameters from V7 and earlier fail or misbehave on the current version.

## Version

- The current and default version is **V8.2**, released 2026-07-24. Select it with `--v 8.2`, or leave `--v` out.
- Use another version only when the user names one. V8.0 is retired. V7 is `--v 7`.
- There is no Niji for V8. The newest is `--niji 7`, which runs on the V7 generation and takes V7 parameters.

## How a prompt is built

- This model has no controls. Everything goes in `prompt`, and `params` must stay empty.
- Parameters go at the very end, after all prompt text. One space before `--`, and no punctuation after a value.
- `references` become image prompts: the server puts their URLs at the start of the prompt. An image prompt needs text with it, or a second image.
- Images for `--sref` are not `references`. Write their URLs in `prompt`, after the flag, separated by spaces.
- Image URLs must be public and end in `.png`, `.jpg`, `.jpeg`, `.webp` or `.gif`.
- One run returns four images. Ask for more with `runs`, never with `--repeat`.

## Writing the text

- Short and simple prompts work best. Describe the image; do not address the model. Write "Colored pencil illustration of bright orange California poppies", not "Show me a picture of poppies, make them orange".
- Cover what matters from subject, medium, environment, lighting, color, mood and composition. Fewer details give more variety and less control.
- Use specific words and exact counts: "three cats", not "cats".
- Say what should be there. Put exclusions in `--no`.
- For text in the image, put it in double quotes. Short Latin-alphabet phrases work best. If it misrenders, add `--raw` or lower `--s`.

## Parameters in V8.2

| Flag               | Values                             | Default | Effect                                                                          |
| :----------------- | :--------------------------------- | :------ | :------------------------------------------------------------------------------ |
| `--ar`             | `W:H` in whole numbers, up to 14:1 | 1:1     | Aspect ratio. With `--hd` the limit is 4:1.                                     |
| `--stylize`, `--s` | 0 to 1000                          | 100     | How much of Midjourney's own aesthetic is applied. Lower follows the prompt.    |
| `--chaos`, `--c`   | 0 to 100                           | 0       | How much the four images differ from each other.                                |
| `--weird`, `--w`   | 0 to 3000                          | 0       | Unconventional results. Weakens `--seed`.                                       |
| `--raw`            | flag                               | off     | Removes default styling, for closer prompt adherence. Not `--style raw`.        |
| `--no`             | words, comma-separated             | none    | Excludes things. Each word is read alone: `--no modern clothing` bans clothing. |
| `--seed`           | 0 to 4294967295                    | random  | Fixes the starting noise, so a repeat is near identical.                        |
| `--tile`           | flag                               | off     | A seamless repeating tile.                                                      |
| `--hd`, `--sd`     | flag                               | account | `--hd` is 2048px native, `--sd` is 1024px.                                      |
| `--sref`           | image URLs, style codes, `random`  | none    | Style reference. Needs a text prompt. Keep that text simple.                    |
| `--sw`             | 0 to 1000                          | 100     | Strength of `--sref`.                                                           |
| `--iw`             | 0 to 3                             | 1       | Weight of the image prompts against the text.                                   |
| `--profile`, `--p` | bare, or a profile or moodboard ID | off     | Personalization. Use only when the user gives an ID.                            |

## The Edit Model

- Midjourney documents `--edit` with up to four image URLs: the text becomes an instruction applied to those images. It replaces Omni Reference, Character Reference and Retexture.
- **It does not work through this server.** Tested 2026-11-11: the task succeeds, but the image after `--edit` is ignored and the result is a fresh image from the text alone. Do not use it, and tell the user when they ask for an edit of an existing image. Another model with the `image-edit` capability in `list_models` can do that.

## Removed since V7

These fail or do nothing on V8.2. Do not write them.

| Old habit                   | On V8.2                                                             |
| :-------------------------- | :------------------------------------------------------------------ |
| `--oref`, `--ow`            | Unsupported. No replacement here.                                   |
| `--cref`, `--cw`            | Legacy, V6 only. No replacement here.                               |
| `--q`, `--quality`          | Unsupported. Resolution is `--hd` or `--sd`.                        |
| `--style raw`               | Write `--raw`.                                                      |
| `--niji`                    | No V8 Niji. `--niji 7` switches the whole job to the V7 generation. |
| `::` multi-prompts, weights | Unsupported since V7. Write one description.                        |
| `--stop`                    | V6 and earlier only.                                                |
| `--turbo`                   | Unsupported.                                                        |

## Not for this server

- `--repeat`, `--fast`, `--relax`, `--stealth` and `--public` belong to the Midjourney account, and `--draft` and the video flags (`--video`, `--motion`, `--loop`, `--end`, `--bs`) to other surfaces. Leave them out.
- A parameter the provider refuses fails the task with its reason, such as `Invalid parameter value: --version 99`. Fix the prompt from that message and report it to the user.

## Sources

- <https://docs.midjourney.com/hc/en-us/articles/32859204029709-Parameter-List>
- <https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version>
- <https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model>
- <https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics>
- <https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference>
- <https://docs.midjourney.com/hc/en-us/articles/32040250122381-Image-Prompts>
