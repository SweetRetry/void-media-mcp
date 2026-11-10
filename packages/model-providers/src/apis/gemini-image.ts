import { z } from "zod"

import { type Adapter, json, unreadable } from "./api"

const response = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(
              z.object({
                inlineData: z.object({ mimeType: z.string(), data: z.string() }).optional(),
              })
            ),
          })
          .optional(),
        finishReason: z.string().optional(),
      })
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string() }).optional(),
})

/** Google's `generateContent`. Image controls sit under `generationConfig.imageConfig`. References go as `fileData` URLs, never inlined. */
export const geminiImage: Adapter = {
  submit(model, { prompt, references, params }) {
    return {
      method: "POST",
      path: `/v1beta/models/${model.id}:generateContent`,
      body: json({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...references.map((reference) => ({
                fileData: { mimeType: reference.mime, fileUri: reference.url },
              })),
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            ...(params.aspectRatio && { aspectRatio: params.aspectRatio }),
            ...(params.resolution && { imageSize: params.resolution }),
          },
        },
      }),
    }
  },
  read(body) {
    const parsed = response.safeParse(body)
    if (!parsed.success) return unreadable("Gemini", parsed.error)
    const { candidates = [], promptFeedback } = parsed.data
    const results = candidates.flatMap((candidate) =>
      (candidate.content?.parts ?? []).flatMap(({ inlineData }) =>
        inlineData
          ? [
              {
                asset: {
                  kind: "inline" as const,
                  mime: inlineData.mimeType,
                  base64: inlineData.data,
                },
              },
            ]
          : []
      )
    )
    if (results.length) return { state: "done", result: { type: "image", results } }
    const reason = promptFeedback?.blockReason ?? candidates[0]?.finishReason ?? "No image"
    return { state: "failed", reason }
  },
}
