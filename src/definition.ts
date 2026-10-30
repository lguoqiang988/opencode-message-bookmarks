import { Schema } from "effect"
import { Plugin, Store } from "@opencode/plugin/gui"

/** Declarations shared by the plugin entry and its components. */
export const definition = Plugin.define({
  stores: {
    prefs: Store.global(Schema.Struct({ rail: Schema.Boolean }), { rail: true }),
  },
  i18n: {
    en: {
      "command.toggle": "Toggle message bookmarks",
      "command.description": "Show or hide the bookmark rail beside the conversation",
      "toast.title": "Message bookmarks",
      "toast.on": "The bookmark rail is back.",
      "toast.off": "The bookmark rail is hidden.",
      "panel.empty": "No messages yet",
      "panel.attachment": "(attachment)",
    },
    "zh-Hans": {
      "command.toggle": "切换消息书签栏",
      "command.description": "显示或隐藏会话右侧的消息书签栏",
      "toast.title": "消息书签",
      "toast.on": "书签栏已恢复。",
      "toast.off": "书签栏已隐藏。",
      "panel.empty": "还没有消息",
      "panel.attachment": "（附件）",
    },
  },
})
