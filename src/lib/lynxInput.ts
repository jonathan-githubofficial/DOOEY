// Imperative helpers for the Lynx <input>/<textarea> elements, which are uncontrolled and
// event-driven: they expose NO `value`/`defaultValue` prop (verified against @lynx-js/types
// input.d.ts / textarea.d.ts - the documented surface is `bindinput`/`bindblur`/`bindconfirm`
// plus the imperative UI methods). Controlled behaviour therefore rides those UI methods through
// `lynx.createSelectorQuery().select("#id").invoke(...)`
// (https://lynxjs.org/api/lynx-api/nodes-ref/nodes-ref-invoke):
//   - `focus`   opens the field / soft keyboard (unit 4.2 SPEC 6 autoFocus replacement), and
//   - `setValue` fills the field's current text (pre-fill on mount / external change).
// Both are implemented by @lynx-js/web-elements XInput/XTextarea (dist/.../XInput.js: `focus()`,
// `setValue({ value })`; the elements also observe a `value` attribute), so this is the
// R11-safe controlled-input seam on the web target. `lynx` is the background-thread global
// (declared by @lynx-js/types).
import { useState } from "react";

import { newId } from "./id";

/** Move focus to (and open the keyboard for) the Lynx input/textarea with this id. */
export function focusInput(id: string): void {
  lynx.createSelectorQuery().select(`#${id}`).invoke({ method: "focus" }).exec();
}

/** Set the current text of the Lynx input/textarea with this id (the uncontrolled fill seam). */
export function setInputValue(id: string, value: string): void {
  lynx
    .createSelectorQuery()
    .select(`#${id}`)
    .invoke({ method: "setValue", params: { value } })
    .exec();
}

/** A stable, per-instance element id that is a valid `#id` selector (letter-prefixed). The
 * lazy `useState` initializer runs once, so the id is stable across re-renders. */
export function useDomId(prefix: string): string {
  const [id] = useState(() => `${prefix}-${newId()}`);
  return id;
}
