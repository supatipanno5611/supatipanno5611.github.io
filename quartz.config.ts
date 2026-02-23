import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "viriya",
    pageTitleSuffix: " · buddhadhamma.kr",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "ko-KR",
    baseUrl: "buddhadhamma.kr",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Gowun Batang",
        body: "Gowun Batang",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#FAF9F7",        // Claude 특유의 따뜻한 흰색 배경
          lightgray: "#E8E3DC",    // 따뜻한 연회색
          gray: "#B5ADA3",         // 중간 회색
          darkgray: "#5C554D",     // 본문 글자 (따뜻한 다크)
          dark: "#1A1612",         // 제목 글자 (진한 갈색빛 검정)
          secondary: "#D97757",    // Claude 오렌지 포인트 (링크색)
          tertiary: "#C4643E",     // 호버시 더 진한 오렌지
          highlight: "rgba(217, 119, 87, 0.12)",
          textHighlight: "#FFF3CD88",
        },
        darkMode: {
          light: "#22272E",        // GitHub soft dark 배경
          lightgray: "#2D333B",    // 카드/경계선
          gray: "#545D68",         // 중간 회색
          darkgray: "#ADBAC7",     // 본문 글자
          dark: "#CDD9E5",         // 제목 글자
          secondary: "#539BF5",    // GitHub 파란 링크
          tertiary: "#6CB6FF",     // 호버시 밝은 파랑
          highlight: "rgba(83, 155, 245, 0.12)",
          textHighlight: "#E3B34188",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
