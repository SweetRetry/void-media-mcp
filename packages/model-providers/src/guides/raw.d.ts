/** A guide is Markdown read as text at build time, so one file serves the resource and the tool. */
declare module "*.md?raw" {
  const text: string
  export default text
}
