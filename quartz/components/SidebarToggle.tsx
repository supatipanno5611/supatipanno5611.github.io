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
    const sidebarBtns = document.querySelectorAll(".footer-btn")
    sidebarBtns.forEach(btn => btn.classList.add("sidebar-btn-locked"))
    setTimeout(() => {
      sidebarBtns.forEach(btn => btn.classList.remove("sidebar-btn-locked"))
    }, 400)
  }

  closeAll()

  function handleTouchStart(e) {
    const touchX = e.touches[0].clientX
    const isLeftOpen = leftSidebar?.classList.contains("open")
    const isRightOpen = rightSidebar?.classList.contains("open")

    if (isLeftOpen && touchX >= window.innerWidth * 0.9) {
      closeAll()
    } else if (isRightOpen && touchX <= window.innerWidth * 0.1) {
      closeAll()
    }
  }

  document.addEventListener("touchstart", handleTouchStart, { passive: true })

  window.addCleanup(() => {
    document.removeEventListener("touchstart", handleTouchStart)
  })
})
`

export default (() => SidebarToggle) satisfies QuartzComponentConstructor