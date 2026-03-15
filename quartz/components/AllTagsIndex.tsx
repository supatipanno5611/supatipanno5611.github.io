import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { QuartzPluginData } from "../plugins/vfile"
import allTagsIndexStyle from "./styles/allTagsIndex.scss"

type TagGroup = {
  directFiles: QuartzPluginData[]
  children: Map<string, QuartzPluginData[]>
}

const EXCLUDED_PREFIXES = ["tags/", "works/"]
const EXCLUDED_SLUGS = ["index", "tags-overview"]

const AllTagsIndex: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  if (fileData.slug !== "tags-overview") return null

  const groups = new Map<string, TagGroup>()

  for (const file of allFiles) {
    if (
      EXCLUDED_SLUGS.includes(file.slug!) ||
      EXCLUDED_PREFIXES.some((p) => file.slug!.startsWith(p))
    ) continue

    const tags: string[] = file.frontmatter?.tags ?? []
    for (const tag of tags) {
      const slash = tag.indexOf("/")
      const parent = slash === -1 ? tag : tag.slice(0, slash)
      const child = slash === -1 ? null : tag.slice(slash + 1)

      if (!groups.has(parent)) {
        groups.set(parent, { directFiles: [], children: new Map() })
      }
      const group = groups.get(parent)!

      if (child) {
        if (!group.children.has(child)) group.children.set(child, [])
        group.children.get(child)!.push(file)
      } else {
        group.directFiles.push(file)
      }
    }
  }

  const byTitle = (a: QuartzPluginData, b: QuartzPluginData) =>
    (a.frontmatter?.title ?? "").localeCompare(b.frontmatter?.title ?? "", "ko")

  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "ko"))

  return (
    <div class="all-tags-index">
      {sorted.map(([parent, group]) => {
        const childEntries = [...group.children.entries()].sort(([a], [b]) =>
          a.localeCompare(b, "ko"),
        )
        const totalCount =
          group.directFiles.length +
          childEntries.reduce((sum, [, files]) => sum + files.length, 0)

        return (
          <div class="tag-group" key={parent}>
            <div class="tag-group-header">
              <span class="tag-group-name">{parent}</span>
              <span class="tag-group-count">({totalCount})</span>
            </div>

            <div class="tag-group-body">
              {group.directFiles.length > 0 && (
                <ul class="tag-file-list">
                  {[...group.directFiles].sort(byTitle).map((file) => (
                    <li key={file.slug}>
                      <a href={`/${file.slug}`}>{file.frontmatter?.title ?? file.slug}</a>
                    </li>
                  ))}
                </ul>
              )}

              {childEntries.map(([child, files]) => (
                <div class="tag-child-group" key={child}>
                  <div class="tag-child-header">
                    <span class="tag-child-name">{child}</span>
                    <span class="tag-group-count">({files.length})</span>
                  </div>
                  <ul class="tag-file-list">
                    {[...files].sort(byTitle).map((file) => (
                      <li key={file.slug}>
                        <a href={`/${file.slug}`}>{file.frontmatter?.title ?? file.slug}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

AllTagsIndex.css = allTagsIndexStyle

export default (() => AllTagsIndex) satisfies QuartzComponentConstructor