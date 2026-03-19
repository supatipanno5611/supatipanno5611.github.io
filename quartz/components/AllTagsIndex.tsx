import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { QuartzPluginData } from "../plugins/vfile"
import allTagsIndexStyle from "./styles/allTagsIndex.scss"
import { Date } from "./Date"

type TagGroup = {
  directFiles: QuartzPluginData[]
  children: Map<string, QuartzPluginData[]>
}

const EXCLUDED_PREFIXES = ["tags/", "works/"]
const EXCLUDED_SLUGS = ["index", "tags-overview"]

const AllTagsIndex: QuartzComponent = ({ cfg, fileData, allFiles }: QuartzComponentProps) => {
  if (fileData.slug !== "tags-overview") return null

  const groups = new Map<string, TagGroup>()
  const untagged: QuartzPluginData[] = []

  for (const file of allFiles) {
    if (
      EXCLUDED_SLUGS.includes(file.slug!) ||
      EXCLUDED_PREFIXES.some((p) => file.slug!.startsWith(p))
    ) continue

    const tags: string[] = file.frontmatter?.tags ?? []

    if (tags.length === 0) {
      untagged.push(file)
      continue
    }

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

  const sorted = [...groups.entries()].sort(([aKey, aGroup], [bKey, bGroup]) => {
    const getMaxDate = (group: TagGroup): number => {
      const allFiles = [
        ...group.directFiles,
        ...[...group.children.values()].flat(),
      ]
      return Math.max(
        0,
        ...allFiles.map((f) => (f.dates?.modified ?? f.dates?.created)?.getTime() ?? 0),
      )
    }

    const getTotalCount = (group: TagGroup): number =>
      group.directFiles.length + [...group.children.values()].reduce((s, f) => s + f.length, 0)

    const aDate = getMaxDate(aGroup)
    const bDate = getMaxDate(bGroup)
    if (bDate !== aDate) return bDate - aDate

    const aCount = getTotalCount(aGroup)
    const bCount = getTotalCount(bGroup)
    if (bCount !== aCount) return bCount - aCount

    return aKey.localeCompare(bKey, "ko")
  })

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
                      {file.dates && (
                        <span class="file-dates">
                          <span>수정: <Date date={file.dates.modified} locale={cfg.locale} /></span>
                          <span>작성: <Date date={file.dates.created} locale={cfg.locale} /></span>
                        </span>
                      )}
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
                        {file.dates && (
                          <span class="file-dates">
                            <span>수정: <Date date={file.dates.modified} locale={cfg.locale} /></span>
                            <span>작성: <Date date={file.dates.created} locale={cfg.locale} /></span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {untagged.length > 0 && (
        <div class="tag-group">
          <div class="tag-group-header">
            <span class="tag-group-name">미분류</span>
            <span class="tag-group-count">({untagged.length})</span>
          </div>
          <div class="tag-group-body">
            <ul class="tag-file-list">
              {[...untagged].sort(byTitle).map((file) => (
                <li key={file.slug}>
                  <a href={`/${file.slug}`}>{file.frontmatter?.title ?? file.slug}</a>
                  {file.dates && (
                    <span class="file-dates">
                      <span>수정: <Date date={file.dates.modified} locale={cfg.locale} /></span>
                      <span>작성: <Date date={file.dates.created} locale={cfg.locale} /></span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

AllTagsIndex.css = allTagsIndexStyle

export default (() => AllTagsIndex) satisfies QuartzComponentConstructor