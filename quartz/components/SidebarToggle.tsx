import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const SidebarToggle: QuartzComponent = () => {
  return <></>
}

SidebarToggle.afterDOMLoaded = `
document.addEventListener("nav", () => {
  const leftSidebar = document.querySelector(".sidebar.left")
  const rightSidebar = document.querySelector(".sidebar.right")

  function openLeft() {
    leftSidebar?.classList.add("open")
    rightSidebar?.classList.remove("open")
  }

  function openRight() {
    rightSidebar?.classList.add("open")
    leftSidebar?.classList.remove("open")
  }

  function closeAll() {
    leftSidebar?.classList.remove("open")
    rightSidebar?.classList.remove("open")
  }

  // 네비게이션 시 사이드바 상태 초기화
  closeAll()

  // 스와이프 감지
  let touchStartX = 0
  let touchStartY = 0

  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY

    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) < 40) return

    const isLeftSidebarOpen = leftSidebar?.classList.contains("open")
    const isRightSidebarOpen = rightSidebar?.classList.contains("open")

    if (dx > 0) {
      if (isRightSidebarOpen) {
        // 오른쪽 사이드바가 열려있을 때만 닫기
        closeAll()
      } else if (!isLeftSidebarOpen) {
        // 둘 다 닫혀있을 때만 열기
        openLeft()
      }
    } else {
      if (isLeftSidebarOpen) {
        // 왼쪽 사이드바가 열려있을 때만 닫기
        closeAll()
      } else if (!isRightSidebarOpen) {
        // 둘 다 닫혀있을 때만 열기
        openRight()
      }
    }
  }

  document.addEventListener("touchstart", handleTouchStart, { passive: true })
  document.addEventListener("touchend", handleTouchEnd, { passive: true })

  window.addCleanup(() => {
    backdrop.removeEventListener("click", closeAll)
    document.removeEventListener("touchstart", handleTouchStart)
    document.removeEventListener("touchend", handleTouchEnd)
  })
})
`

export default (() => SidebarToggle) satisfies QuartzComponentConstructor
