import { Command, Plugin, Slot, Style } from "@opencode/plugin/gui"
import css from "./rail.css?inline"
import { definition } from "./definition"
import { RailSlot } from "./rail"

export default Plugin.define({
  ...definition,
  setup(ctx) {
    const prefs = ctx.stores.prefs

    ctx.add(Style, css)

    ctx.add(Slot, {
      at: "session.header",
      order: 100,
      render: (input) => <RailSlot session={input.session} active={input.active} />,
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
