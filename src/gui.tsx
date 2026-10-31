import { Command, Plugin, Slot, Style } from "@opencode/plugin/gui"
import css from "./rail.css?inline"
import { definition } from "./definition"
import { RailWindow } from "./rail"

export default Plugin.define({
  ...definition,
  setup(ctx) {
    const prefs = ctx.stores.prefs

    ctx.add(Style, css)

    // `window.bottom` is always rendered, also in the narrow layout where the session header is
    // replaced by the tab strip. The rail positions itself on the timeline it finds.
    ctx.add(Slot, {
      at: "window.bottom",
      order: 100,
      render: () => <RailWindow />,
    })

    ctx.add(Command, () => ({
      id: "toggle",
      title: ctx.t("command.toggle"),
      description: ctx.t("command.description"),
      keywords: "bookmark rail jump message navigate 书签",
      run: () => {
        const next = !prefs.value.rail

        prefs.set({ rail: next })
        ctx.toast.show({
          title: ctx.t("toast.title"),
          description: ctx.t(next ? "toast.on" : "toast.off"),
        })
      },
    }))
  },
})
