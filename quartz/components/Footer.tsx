import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import footerStyle from "./styles/footer.scss"

// 제외할 경로 prefix 목록 — 추가할 경로가 생기면 여기에만 추가하면 됩니다
const EXCLUDED_PREFIXES = ["tags/", "works/"]
// 제외할 정확한 slug 목록
const EXCLUDED_SLUGS = ["index", "tags-overview"]

// ── 버튼 텍스트 — 여기서만 수정하세요 ──────────────────
const LABELS = {
  share: "링크 복사",
  shareCopied: "복사됨",
  question: "질문하기",
  search: "검색하기",
  graph: "그래프 보기",
  random: "무작위 읽기",
  tags: "전체 글 목록",
  download: "마크다운 다운로드",
}
// ────────────────────────────────────────────────────────

const Footer: QuartzComponent = ({ allFiles }: QuartzComponentProps) => {
  const pages = allFiles
    .map((f) => f.slug!)
    .filter(
      (slug) =>
        !EXCLUDED_SLUGS.includes(slug) &&
        !EXCLUDED_PREFIXES.some((prefix) => slug.startsWith(prefix)),
    )

  return (
    <footer>
      {/* 줄 1: 공유, 질문 */}
      <div class="footer-row">
        <button class="footer-btn share-btn" aria-label={LABELS.share} data-label={LABELS.share} data-label-copied={LABELS.shareCopied}>
          <svg class="icon-share" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          <svg class="icon-copied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m12 15 2 2 4-4"/>
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          <span class="btn-label">{LABELS.share}</span>
        </button>

        <button
          class="footer-btn tally-btn"
          aria-label={LABELS.question}
          data-tally-open="rjKA72"
          data-tally-layout="modal"
          data-tally-hide-title="1"
          data-tally-overlay="1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <path d="M12 17h.01"/>
          </svg>
          <span class="btn-label">{LABELS.question}</span>
        </button>
      </div>

      {/* 줄 2: 검색, 그래프 (모바일 전용) */}
      <div class="footer-row footer-row-mobile">
        <button class="footer-btn sidebar-search-btn" aria-label={LABELS.search}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m21 21-4.34-4.34"/>
            <circle cx="11" cy="11" r="8"/>
          </svg>
          <span class="btn-label">{LABELS.search}</span>
        </button>

        <button class="footer-btn sidebar-graph-btn" aria-label={LABELS.graph}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="18" r="3"/>
            <circle cx="6" cy="6" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
            <path d="M12 12v3"/>
          </svg>
          <span class="btn-label">{LABELS.graph}</span>
        </button>
      </div>

      {/* 줄 3: 인연 따라 읽기, 태그 목록 */}
      <div class="footer-row">
        <button
          class="footer-btn random-page-btn"
          data-pages={JSON.stringify(pages)}
          aria-label={LABELS.random}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/>
            <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/>
            <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/>
            <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>
          </svg>
          <span class="btn-label">{LABELS.random}</span>
        </button>

        <button class="footer-btn tags-overview-btn" aria-label={LABELS.tags}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/>
            <path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>
          </svg>
          <span class="btn-label">{LABELS.tags}</span>
        </button>
      </div>

      {/* 줄 4: 마크다운 다운로드 (downloadable: true 인 페이지에서만 표시) */}
      <div class="footer-row download-row" style="display: none;">
        <a class="footer-btn download-btn" aria-label={LABELS.download} download>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" x2="12" y1="15" y2="3"/>
          </svg>
          <span class="btn-label">{LABELS.download}</span>
        </a>
      </div>
    </footer>
  )
}

Footer.css = footerStyle

Footer.beforeDOMLoaded = `
  const tallyScript = document.createElement("script")
  tallyScript.src = "https://tally.so/widgets/embed.js"
  tallyScript.async = true
  document.head.appendChild(tallyScript)
`

Footer.afterDOMLoaded = `
  function setupFooter() {
    // ── Tally 재스캔 (SPA 네비게이션 후 버튼 재등록) ──
    if (window.Tally) {
      window.Tally.loadEmbeds()
    }

    // ── 공유 버튼 ──
    const shareBtn = document.querySelector(".share-btn")
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
          shareBtn.classList.add("copied")
          setTimeout(() => shareBtn.classList.remove("copied"), 2000)
        })
      })
    }

    // ── 검색 버튼 (왼쪽 사이드바 열기) ──
    const searchBtn = document.querySelector(".sidebar-search-btn")
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        const left = document.querySelector(".sidebar.left")
        const right = document.querySelector(".sidebar.right")
        right?.classList.remove("open")
        left?.classList.add("open")
      })
    }

    // ── 그래프 버튼 (오른쪽 사이드바 열기) ──
    const graphBtn = document.querySelector(".sidebar-graph-btn")
    if (graphBtn) {
      graphBtn.addEventListener("click", () => {
        const left = document.querySelector(".sidebar.left")
        const right = document.querySelector(".sidebar.right")
        left?.classList.remove("open")
        right?.classList.add("open")
      })
    }

    // ── 전체 게시글 목록 보기 버튼 ──
    const tagsBtn = document.querySelector(".tags-overview-btn")
    if (tagsBtn) {
      tagsBtn.addEventListener("click", () => {
        window.location.href = "/tags-overview"
      })
    }

    // ── 인연 따라 읽기 버튼 ──
    const randomBtn = document.querySelector(".random-page-btn")
    if (randomBtn) {
      randomBtn.addEventListener("click", () => {
        const pages = JSON.parse(randomBtn.dataset.pages)
        const currentSlug = document.body.dataset.slug
        const candidates = pages.filter((p) => p !== currentSlug)
        if (candidates.length === 0) return
        const target = candidates[Math.floor(Math.random() * candidates.length)]
        window.location.href = "/" + target
      })
    }

    // ── 마크다운 다운로드 버튼 ──
    const downloadRow = document.querySelector(".download-row")
    const downloadBtn = document.querySelector(".download-btn")
    if (downloadRow && downloadBtn) {
      const slug = document.body.dataset.slug
      const rawUrl = "/raw/" + slug + ".md"
      fetch(rawUrl, { method: "HEAD" })
        .then((res) => {
          if (res.ok) {
            downloadBtn.href = rawUrl
            downloadRow.style.display = ""
          } else {
            downloadRow.style.display = "none"
          }
        })
        .catch(() => {
          downloadRow.style.display = "none"
        })
    }
  }

  document.addEventListener("nav", setupFooter)
  setupFooter()
`

export default (() => Footer) satisfies QuartzComponentConstructor