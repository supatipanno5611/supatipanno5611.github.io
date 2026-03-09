import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import footerStyle from "./styles/footer.scss"

// 제외할 경로 prefix 목록 — 추가할 경로가 생기면 여기에만 추가하면 됩니다
const EXCLUDED_PREFIXES = ["tags/", "works/"]
// 제외할 정확한 slug 목록
const EXCLUDED_SLUGS = ["index"]

// ── 버튼 텍스트 — 여기서만 수정하세요 ──────────────────
const LABELS = {
  share: "링크 복사",
  shareCopied: "복사됨",
  question: "질문하기",
  search: "검색",
  graph: "그래프",
  random: "인연 따라 읽기",
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
        <button class="footer-btn sidebar-search-btn" aria-label="검색">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m21 21-4.34-4.34"/>
            <circle cx="11" cy="11" r="8"/>
          </svg>
        </button>

        <button class="footer-btn sidebar-graph-btn" aria-label="그래프 보기">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="18" r="3"/>
            <circle cx="6" cy="6" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
            <path d="M12 12v3"/>
          </svg>
        </button>
      </div>

      {/* 줄 3: 인연 따라 읽기 */}
      <div class="footer-row">
        <button
          class="footer-btn random-page-btn"
          data-pages={JSON.stringify(pages)}
          aria-label="인연 따라 읽기"
        >
          <svg class="random-page-icon" viewBox="-7.5 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="currentColor" d="M14.92 17.56c-0.32-0.32-0.88-0.32-1.2 0s-0.32 0.88 0 1.2l0.76 0.76h-3.76c-0.6 0-1.080-0.32-1.6-0.96-0.28-0.36-0.8-0.44-1.2-0.16-0.36 0.28-0.44 0.8-0.16 1.2 0.84 1.12 1.8 1.64 2.92 1.64h3.76l-0.76 0.76c-0.32 0.32-0.32 0.88 0 1.2 0.16 0.16 0.4 0.24 0.6 0.24s0.44-0.080 0.6-0.24l2.2-2.2c0.32-0.32 0.32-0.88 0-1.2l-2.16-2.24z"/>
            <path fill="currentColor" d="M10.72 12.48h3.76l-0.76 0.76c-0.32 0.32-0.32 0.88 0 1.2 0.16 0.16 0.4 0.24 0.6 0.24s0.44-0.080 0.6-0.24l2.2-2.2c0.32-0.32 0.32-0.88 0-1.2l-2.2-2.2c-0.32-0.32-0.88-0.32-1.2 0s-0.32 0.88 0 1.2l0.76 0.76h-3.76c-2.48 0-3.64 2.56-4.68 4.84-0.88 2-1.76 3.84-3.12 3.84h-2.080c-0.48 0-0.84 0.36-0.84 0.84s0.36 0.88 0.84 0.88h2.080c2.48 0 3.64-2.56 4.68-4.84 0.88-2 1.72-3.88 3.12-3.88z"/>
            <path fill="currentColor" d="M0.84 12.48h2.080c0.6 0 1.080 0.28 1.56 0.92 0.16 0.2 0.4 0.32 0.68 0.32 0.2 0 0.36-0.040 0.52-0.16 0.36-0.28 0.44-0.8 0.16-1.2-0.84-1.040-1.8-1.6-2.92-1.6h-2.080c-0.48 0.040-0.84 0.4-0.84 0.88s0.36 0.84 0.84 0.84z"/>
          </svg>
          인연 따라 읽기
        </button>
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
  }

  document.addEventListener("nav", setupFooter)
  setupFooter()
`

export default (() => Footer) satisfies QuartzComponentConstructor