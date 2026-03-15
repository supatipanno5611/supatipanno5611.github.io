import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [Component.SidebarToggle()],
  footer: Component.Footer(),
}

export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    Component.AllTagsIndex(),
  ],
  left: [
    Component.PageTitle(),
    Component.Darkmode(),
    Component.RecentNotes({ title: "최근에 수정한 글",limit: 5, showTags: true }),
    Component.Search()
  ],
  right: [
    Component.Graph(),
    Component.TableOfContents(),
    Component.Backlinks()
  ],
}

export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.Darkmode(),
    Component.RecentNotes({ limit: 5, showTags: true }),
    Component.Search(),
  ],
  right: [
    Component.TableOfContents(),
    Component.Backlinks()
  ],
}
