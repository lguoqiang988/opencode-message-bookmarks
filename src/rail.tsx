import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Portal } from "solid-js/web"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { currentTurn, revealMessage, scrollerFor, type UserMessage } from "./jump"

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > 160 ? flat.slice(0, 160) + "…" : flat
}

/** Renders the rail beside the timeline that owns this header. */
export function RailSlot(props: { session: { id: string }; active: boolean }) {
  const ctx = usePlugin<typeof definition>()
  const [host, setHost] = createSignal<HTMLSpanElement>()
  const [scroller, setScroller] = createSignal<HTMLElement>()

  onMount(() => {
    const found = scrollerFor(host())
    if (found) setScroller(found)
  })

  return (
    <>
      <span ref={setHost} style={{ display: "none" }} />
      <Show when={props.active && ctx.stores.prefs.value.rail ? scroller() : undefined}>
        {(target) => <Rail session={props.session} scroller={target()} />}
      </Show>
    </>
  )
}

function Rail(props: { session: { id: string }; scroller: HTMLElement }) {
  const ctx = usePlugin<typeof definition>()

  const [items, setItems] = createSignal<UserMessage[]>([])
  const [box, setBox] = createSignal({ top: 0, height: 0, right: 0 })
  const [open, setOpen] = createSignal(false)
  const [hover, setHover] = createSignal(-1)
  const [anchor, setAnchor] = createSignal(-1)
  const [active, setActive] = createSignal(-1)

  let list: HTMLDivElement | undefined
  let rail: HTMLDivElement | undefined
  let marks: HTMLDivElement | undefined
  let panel: HTMLDivElement | undefined

  const [panelTop, setPanelTop] = createSignal(0)
  const [ready, setReady] = createSignal(false)

  const index = createMemo(() => {
    const map = new Map<string, number>()
    items().forEach((item, at) => map.set(item.id, at))
    return map
  })

  const load = async (sessionID: string) => {
    try {
      const collected: UserMessage[] = []
      let cursor: string | undefined

      for (let page = 0; page < 5; page++) {
        const response = await ctx.client.message.list(
          cursor
            ? { sessionID, limit: 200, cursor }
            : { sessionID, type: "user", order: "desc", limit: 200 },
        )

        for (const message of response.data ?? []) {
          if ((message as { type?: string }).type !== "user") continue
          collected.push({ id: message.id, text: String((message as { text?: string }).text ?? "") })
        }

        cursor = response.cursor?.next ?? undefined
        if (!cursor) break
      }

      const next = collected.reverse()
      const current = items()
      if (
        current.length === next.length &&
        current.every((item, at) => item.id === next[at].id && item.text === next[at].text)
      ) {
        return
      }
      setItems(next)
    } catch {
      // Keep the last list while the server is unreachable.
    }
  }

  const measure = () => {
    const rect = props.scroller.getBoundingClientRect()
    // A hidden or collapsing timeline reports a tiny rect; keep the last good one.
    if (rect.width < 200 || rect.height < 160) return
    setBox({
      top: Math.round(rect.top) + 8,
      height: Math.max(0, Math.round(rect.height) - 16),
      right: Math.max(0, Math.round(window.innerWidth - rect.right) + 4),
    })
  }

  const syncActive = () => {
    const at = currentTurn(props.scroller, index())
    if (at >= 0) setActive(at)
  }

  const jump = async (at: number) => {
    const message = items()[at]
    if (!message) return
    setOpen(false)
    setHover(-1)
    if (await revealMessage((id) => ctx.commands.run(id), props.scroller, index(), message.id)) setActive(at)
  }

  createEffect(() => {
    void load(props.session.id)
  })

  createEffect(() => {
    const at = anchor()
    if (!open() || at < 0) {
      setReady(false)
      return
    }
    measure()
    requestAnimationFrame(() => {
      const host = rail
      const track = marks
      const card = panel
      const mark = track?.children[at]
      if (!host || !card || !(mark instanceof HTMLElement)) return

      const hostRect = host.getBoundingClientRect()
      const markRect = mark.getBoundingClientRect()
      const center = markRect.top + markRect.height / 2 - hostRect.top
      const height = card.offsetHeight
      const max = Math.max(0, hostRect.height - height)
      setPanelTop(Math.round(Math.max(0, Math.min(center - height / 2, max))))
      setReady(true)

      const row = list?.children[at]
      if (list && row instanceof HTMLElement) {
        const top = row.offsetTop
        const bottom = top + row.offsetHeight
        if (top < list.scrollTop) list.scrollTop = top
        else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
      }
    })
  })

  onMount(() => {
    measure()
    syncActive()

    const observer = new ResizeObserver(() => measure())
    observer.observe(props.scroller)

    const resize = () => measure()
    window.addEventListener("resize", resize)

    let queued = false
    const scroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        syncActive()
      })
    }
    props.scroller.addEventListener("scroll", scroll, { passive: true })

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(props.session.id)
    }, 8000)

    const layout = window.setInterval(() => {
      if (document.visibilityState === "visible") measure()
    }, 2000)

    onCleanup(() => {
      observer.disconnect()
      window.removeEventListener("resize", resize)
      props.scroller.removeEventListener("scroll", scroll)
      window.clearInterval(timer)
      window.clearInterval(layout)
    })
  })

  return (
    <Portal mount={document.body}>
      <div
        class="oc-rail"
        ref={(element) => (rail = element)}
        style={{ top: `${box().top}px`, right: `${box().right}px`, height: `${box().height}px` }}
        onMouseLeave={() => {
          setOpen(false)
          setHover(-1)
        }}
      >
        <div class="oc-rail-marks" ref={(element) => (marks = element)}>
          <For each={items()}>
            {(item, at) => (
              <button
                type="button"
                class="oc-rail-mark"
                title={preview(item.text)}
                data-hover={hover() === at() ? "" : undefined}
                data-active={active() === at() ? "" : undefined}
                onMouseEnter={() => {
                  setHover(at())
                  setAnchor(at())
                  setOpen(true)
                }}
                onClick={() => void jump(at())}
              />
            )}
          </For>
        </div>

        <Show when={open() && items().length > 0}>
          <div
            class="oc-rail-panel"
            ref={(element) => (panel = element)}
            style={{ top: `${panelTop()}px`, visibility: ready() ? "visible" : "hidden" }}
          >
            <div class="oc-rail-list" ref={(element) => (list = element)}>
              <For each={items()}>
                {(item, at) => (
                  <button
                    type="button"
                    class="oc-rail-item"
                    data-current={hover() === at() ? "" : undefined}
                    onMouseEnter={() => setHover(at())}
                    onClick={() => void jump(at())}
                  >
                    <span class="oc-rail-text">{preview(item.text) || ctx.t("panel.attachment")}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Portal>
  )
}
