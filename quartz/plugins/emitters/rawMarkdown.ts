import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import fs from "fs"
import path from "path"

export const RawMarkdown: QuartzEmitterPlugin = () => ({
  name: "RawMarkdown",
  getQuartzComponents() {
    return []
  },
  async *emit(ctx, content) {
    for (const [_tree, file] of content) {
      if (!file.data.frontmatter?.downloadable) continue

      const srcPath = file.data.filePath!
      const slug = file.data.slug!
      const destSlug = joinSegments("raw", slug) as FullSlug

      const rawContent = await fs.promises.readFile(srcPath, "utf-8")
      const destPath = joinSegments(ctx.argv.output, destSlug + ".md") as FilePath
      const destDir = path.dirname(destPath)

      await fs.promises.mkdir(destDir, { recursive: true })
      await fs.promises.writeFile(destPath, rawContent, "utf-8")
      yield destPath
    }
  },
  async *partialEmit(ctx, _content, _resources, changeEvents) {
    for (const changeEvent of changeEvents) {
      if (!changeEvent.file) continue
      if (!changeEvent.file.data.frontmatter?.downloadable) continue

      const file = changeEvent.file
      const slug = file.data.slug!
      const destSlug = joinSegments("raw", slug) as FullSlug
      const destPath = joinSegments(ctx.argv.output, destSlug + ".md") as FilePath

      if (changeEvent.type === "add" || changeEvent.type === "change") {
        const srcPath = file.data.filePath!
        const rawContent = await fs.promises.readFile(srcPath, "utf-8")
        const destDir = path.dirname(destPath)
        await fs.promises.mkdir(destDir, { recursive: true })
        await fs.promises.writeFile(destPath, rawContent, "utf-8")
        yield destPath
      } else if (changeEvent.type === "delete") {
        await fs.promises.unlink(destPath).catch(() => {})
      }
    }
  },
})