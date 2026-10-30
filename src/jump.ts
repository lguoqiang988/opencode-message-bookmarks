/** Reading and jumping to the user messages of the mounted session timeline. */

export interface UserMessage {
  readonly id: string
  readonly text: string
}

const VIEWPORT = '[data-slot="session-timeline-scroll"] > .scroll-view__viewport'

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function usable(element: Element | null | undefined): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  const rect = element.getBoundingClientRect()
  if (rect.width < 80 || rect.height < 80) return false
  return typeof element.checkVisibility === "function" ? element.checkVisibility() : true
}

/** The scroller of the timeline that holds `node`, else the one on screen. */
export function scrollerFor(node: Element | null | undefined): HTMLElement | null {
  if (node) {
    const outer = node.closest('[data-slot="session-timeline-scroll"]')
    const viewport = outer?.querySelector(":scope > .scroll-view__viewport")
    if (usable(viewport)) return viewport
  }

  for (const candidate of Array.from(document.querySelectorAll(VIEWPORT))) {
    if (usable(candidate)) return candidate
  }

  return null
}

/**
 * The timeline rows near the viewport, each with the user message that owns its turn.
 * Rows the virtualizer keeps mounted for an anchor far away are left out.
 */
export function visibleTurns(scroller: HTMLElement, index: Map<string, number>): Array<{ at: number; top: number }> {
  const top = scroller.getBoundingClientRect().top
  const bottom = top + scroller.clientHeight
  const rows: Array<{ at: number; top: number }> = []

  for (const node of Array.from(scroller.querySelectorAll("[data-timeline-row][data-message-id]"))) {
    const rect = node.getBoundingClientRect()
    if (rect.bottom < top - 160 || rect.top > bottom + 160) continue
    const at = index.get(node.getAttribute("data-message-id") ?? "")
    if (at === undefined) continue
    rows.push({ at, top: rect.top })
  }

  return rows
}

/** The user message whose turn is nearest the top of the viewport. */
export function currentTurn(scroller: HTMLElement, index: Map<string, number>): number {
  const top = scroller.getBoundingClientRect().top + 100
  let best = -1
  let distance = Number.POSITIVE_INFINITY

  for (const row of visibleTurns(scroller, index)) {
    const next = Math.abs(row.top - top)
    if (next < distance) {
      distance = next
      best = row.at
    }
  }

  return best
}

function rowOf(scroller: HTMLElement, messageID: string): HTMLElement | null {
  return scroller.querySelector<HTMLElement>(`#${CSS.escape("message-" + messageID)}`)
}

function headerInset(scroller: HTMLElement): number {
  const header = scroller.querySelector("[data-session-title]")
  return header instanceof HTMLElement ? header.offsetHeight : 48
}

function align(scroller: HTMLElement, row: HTMLElement): void {
  const inset = headerInset(scroller) + 8
  scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - inset
}

/**
 * Binary search for the scroll offset where the turn of `target` starts. Every row carries the user
 * message of its turn, so the first position whose visible rows reach `target` is that message.
 */
async function searchTurn(scroller: HTMLElement, index: Map<string, number>, target: number, messageID: string) {
  let low = 0
  let high = scroller.scrollHeight

  for (let step = 0; step < 22 && low < high; step++) {
    const middle = Math.floor((low + high) / 2)
    scroller.scrollTop = middle
    await frame()

    const rows = visibleTurns(scroller, index)
    if (rows.length === 0) {
      low = Math.min(high, middle + 2000)
      continue
    }

    if (Math.max(...rows.map((row) => row.at)) < target) low = middle + 1
    else high = middle
  }

  scroller.scrollTop = low
  await frame()

  const row = rowOf(scroller, messageID)
  if (row) {
    align(scroller, row)
    return true
  }

  for (let step = 0; step < 6; step++) {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - Math.round(scroller.clientHeight * 0.6))
    await frame()
    const found = rowOf(scroller, messageID)
    if (found) {
      align(scroller, found)
      return true
    }
  }

  return false
}

/** Walks the app's own message navigation, which also loads older history on the way. */
async function stepTurn(
  run: (id: string) => boolean,
  scroller: HTMLElement,
  index: Map<string, number>,
  target: number,
  messageID: string,
) {
  for (let step = 0; step < 200; step++) {
    const current = currentTurn(scroller, index)
    if (current < 0) return false

    if (current === target) {
      const row = rowOf(scroller, messageID)
      if (row) {
        align(scroller, row)
        return true
      }
    }

    const height = scroller.scrollHeight
    if (!run(target > current ? "message.next" : "message.previous")) return false
    await wait(45)

    if (currentTurn(scroller, index) === current && scroller.scrollHeight === height) {
      await wait(220)
      if (currentTurn(scroller, index) === current && scroller.scrollHeight === height) return false
    }
  }

  const row = rowOf(scroller, messageID)
  if (row) {
    align(scroller, row)
    return true
  }

  return false
}

/**
 * Scrolls the timeline to the user message with `messageID`.
 *
 * The timeline is virtualized, so a message that is not on screen has no DOM node to scroll to.
 * The offset is found by binary search on the turns that are visible at a given scroll position,
 * and the app's own message navigation is the fallback for anything the search cannot reach.
 */
export async function revealMessage(
  run: (id: string) => boolean,
  scroller: HTMLElement,
  index: Map<string, number>,
  messageID: string,
): Promise<boolean> {
  const target = index.get(messageID)
  if (target === undefined) return false

  const mounted = rowOf(scroller, messageID)
  if (mounted) {
    align(scroller, mounted)
    return true
  }

  if (await searchTurn(scroller, index, target, messageID)) return true
  return stepTurn(run, scroller, index, target, messageID)
}
