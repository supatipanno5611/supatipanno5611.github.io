import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import footerStyle from "./styles/footer.scss"

// 제외할 경로 prefix 목록 — 추가할 경로가 생기면 여기에만 추가하면 됩니다
const EXCLUDED_PREFIXES = ["tags/", "works/"]
// 제외할 정확한 slug 목록
const EXCLUDED_SLUGS = ["index"]

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
      <button
        class="random-page-btn"
        data-pages={JSON.stringify(pages)}
        aria-label="인연 따라 읽기"
      >
        <svg
          class="random-page-icon"
          viewBox="-7.5 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M14.92 17.56c-0.32-0.32-0.88-0.32-1.2 0s-0.32 0.88 0 1.2l0.76 0.76h-3.76c-0.6 0-1.080-0.32-1.6-0.96-0.28-0.36-0.8-0.44-1.2-0.16-0.36 0.28-0.44 0.8-0.16 1.2 0.84 1.12 1.8 1.64 2.92 1.64h3.76l-0.76 0.76c-0.32 0.32-0.32 0.88 0 1.2 0.16 0.16 0.4 0.24 0.6 0.24s0.44-0.080 0.6-0.24l2.2-2.2c0.32-0.32 0.32-0.88 0-1.2l-2.16-2.24z"
          />
          <path
            fill="currentColor"
            d="M10.72 12.48h3.76l-0.76 0.76c-0.32 0.32-0.32 0.88 0 1.2 0.16 0.16 0.4 0.24 0.6 0.24s0.44-0.080 0.6-0.24l2.2-2.2c0.32-0.32 0.32-0.88 0-1.2l-2.2-2.2c-0.32-0.32-0.88-0.32-1.2 0s-0.32 0.88 0 1.2l0.76 0.76h-3.76c-2.48 0-3.64 2.56-4.68 4.84-0.88 2-1.76 3.84-3.12 3.84h-2.080c-0.48 0-0.84 0.36-0.84 0.84s0.36 0.88 0.84 0.88h2.080c2.48 0 3.64-2.56 4.68-4.84 0.88-2 1.72-3.88 3.12-3.88z"
          />
          <path
            fill="currentColor"
            d="M0.84 12.48h2.080c0.6 0 1.080 0.28 1.56 0.92 0.16 0.2 0.4 0.32 0.68 0.32 0.2 0 0.36-0.040 0.52-0.16 0.36-0.28 0.44-0.8 0.16-1.2-0.84-1.040-1.8-1.6-2.92-1.6h-2.080c-0.48 0.040-0.84 0.4-0.84 0.88s0.36 0.84 0.84 0.84z"
          />
        </svg>
        인연 따라 읽기
      </button>
    </footer>
  )
}

Footer.css = footerStyle

Footer.afterDOMLoaded = `
  function setupRandomPage() {
    const btn = document.querySelector(".random-page-btn")
    if (!btn) return
    btn.addEventListener("click", () => {
      const pages = JSON.parse(btn.dataset.pages)
      const currentSlug = document.body.dataset.slug
      const candidates = pages.filter((p) => p !== currentSlug)
      if (candidates.length === 0) return
      const target = candidates[Math.floor(Math.random() * candidates.length)]
      window.location.href = "/" + target
    })
  }

  document.addEventListener("nav", setupRandomPage)
  setupRandomPage()
`

export default (() => Footer) satisfies QuartzComponentConstructor