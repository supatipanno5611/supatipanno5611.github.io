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

  closeAll()

  let touchStartX = 0
  let touchStartY = 0
  let touchStartedInsideSidebar = false

  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY

    const isLeftOpen = leftSidebar?.classList.contains("open")
    const isRightOpen = rightSidebar?.classList.contains("open")

    // 사이드바가 열려있을 때 내부 터치인지 확인
    if (isLeftOpen) {
      const sidebarWidth = window.innerWidth * 0.85
      touchStartedInsideSidebar = touchStartX < sidebarWidth

      // 바깥 15% 탭하면 바로 닫기
      if (!touchStartedInsideSidebar) {
        closeAll()
      }
    } else if (isRightOpen) {
      const sidebarStart = window.innerWidth * 0.15
      touchStartedInsideSidebar = touchStartX > sidebarStart

      // 바깥 15% 탭하면 바로 닫기
      if (!touchStartedInsideSidebar) {
        closeAll()
      }
    } else {
      touchStartedInsideSidebar = false
    }
  }

  function handleTouchEnd(e) {
    // 사이드바 내부에서 시작한 터치면 스와이프 무시
    if (touchStartedInsideSidebar) return

    const dx = e.changedTouches[0].clientX - touchStartX
    const dy = e.changedTouches[0].clientY - touchStartY

    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) < 40) return

    const isLeftOpen = leftSidebar?.classList.contains("open")
    const isRightOpen = rightSidebar?.classList.contains("open")

    if (dx > 0) {
      if (!isLeftOpen && !isRightOpen) openLeft()
    } else {
      if (!isLeftOpen && !isRightOpen) openRight()
    }
  }

  document.addEventListener("touchstart", handleTouchStart, { passive: true })
  document.addEventListener("touchend", handleTouchEnd, { passive: true })

  window.addCleanup(() => {
    document.removeEventListener("touchstart", handleTouchStart)
    document.removeEventListener("touchend", handleTouchEnd)
  })
})
`

export default (() => SidebarToggle) satisfies QuartzComponentConstructor
