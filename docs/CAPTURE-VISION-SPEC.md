# Capture + Vault: product vision and design

## Purpose

Lower the barrier to using the extension by reducing manual effort for the common case (login/sign-in capture and fill) while keeping full vault control for complex flows. Two modes live side by side: **Capture** (heuristic, semi-automatic) and **Vault** (manual, full control). This document is the single source for the vision, requirements, and design decisions (including evolutions as we built it).

---

## User problems

- **Manual flow kills adoption:** Creating credentials in the vault (or on the phone) and copying them into the host page (or vice versa) is tedious. Benefit does not outweigh the effort.
- **Complex flows need full control:** Some sites use multi-page sign-in, recovery codes, tokens, or credential files. For these, the user needs the full vault inside the extension, not just a simplified capture flow.
- **Session dropping on navigation:** If the user navigates away from the tab (e.g. to check email for a code), the extension can deactivate. For both capture and complex vault use, the session should be able to persist until the user explicitly ends it or a defined timeout/save condition occurs.

---

## Popup state machine (foundation)

The popup UI is driven by a single **action-aware** state machine. It has explicit **states**, **actions** (events), **transitions** (state × action → next state), and **effects** (what to do when an action is dispatched). The popup and background **dispatch actions** when things happen; the machine transitions and runs effects. All behavior and appearance come from the current state and the derived UI table.

**Implementation:** `client/lib/extension-state.ts`. Popup dispatches actions; reducer returns next state and effects; caller runs effects (e.g. send message to background).

### States

| State | Meaning |
|-------|--------|
| **DISCONNECTED** | Not paired with the relay. Popup shows the connect flow; no tabs. |
| **CONNECTING** | User started connect; QR is showing (or in progress). Still no tabs. |
| **CONNECTED_CAPTURE_OFF** | Paired; user has not activated Capture (or has deactivated). Tabs visible; Vault is enabled. |
| **CONNECTED_CAPTURE_ON** | Paired; user has activated Capture. Tabs visible; Vault tab is disabled until Deactivate. |

### Actions (events that drive the machine)

Every transition is triggered by one of these actions. The popup (or background) dispatches an action when something happens; the machine does not infer state from raw inputs.

| Action | Payload | Who dispatches | When |
|--------|------------------|-----------------|
| **RELAY_STATUS** | `{ paired, hasQrPayload }` | Popup | When relay state is known (on load, WebSocket connects/disconnects/pairs). |
| **CAPTURE_ACTIVATE** | `{ tabId }` | Popup | User clicked Activate in Capture tab. |
| **CAPTURE_DEACTIVATE** | — | Popup or effect | User clicked Deactivate; or we enter DISCONNECTED/CONNECTING and must clear badge. |
| **CAPTURE_STATE_SYNC** | `{ captureActive }` | Popup | After asking background for capture state (e.g. on popup open). |

### Transition table (state × action → next state)

State changes only when an action is dispatched. So “transitions” are: when inputs change, the derived state changes as follows.

| State | Action | Next state |
|-------|--------|-------------|
| * | **RELAY_STATUS** { paired: false, hasQrPayload: false } | **DISCONNECTED** |
| * | **RELAY_STATUS** { paired: false, hasQrPayload: true } | **CONNECTING** |
| * | **RELAY_STATUS** { paired: true } | **CONNECTED_CAPTURE_OFF** or **CONNECTED_CAPTURE_ON** (from current captureActive) |
| CONNECTED_CAPTURE_OFF | **CAPTURE_ACTIVATE** | **CONNECTED_CAPTURE_ON** |
| CONNECTED_CAPTURE_ON | **CAPTURE_DEACTIVATE** | **CONNECTED_CAPTURE_OFF** |
| * | **CAPTURE_STATE_SYNC** { captureActive } | If paired: CONNECTED_CAPTURE_ON when captureActive else CONNECTED_CAPTURE_OFF; if !paired unchanged. |

Invariants: Capture is only “on” when paired. When we are not paired, the popup sends **clear capture** to the background so the badge never shows “ON” while disconnected.

When RELAY_STATUS has paired false, the machine clears capture so we never stay capture-on while disconnected.

### Effects (what to run when an action is dispatched)

The machine returns a list of **effects** the caller must perform: **CLEAR_CAPTURE_IN_BACKGROUND** (when next state is DISCONNECTED or CONNECTING — send CAPTURE_DEACTIVATE to background); **SEND_CAPTURE_ACTIVATE** (when action is CAPTURE_ACTIVATE — send with tabId to background); **SEND_CAPTURE_DEACTIVATE** (when action is CAPTURE_DEACTIVATE — send to background).

### Derived UI (per state)

What the popup shows and does in each state:

| State | showConnectView | connectStage | vaultTabDisabled | captureActiveForUI | clearCaptureInBackground | badge |
|-------|-----------------|-------------|------------------|--------------------|---------------------------|-------|
| **DISCONNECTED** | true | disconnected | n/a | false | **true** | off |
| **CONNECTING** | true | connecting | n/a | false | **true** | off |
| **CONNECTED_CAPTURE_OFF** | false | — | false | false | false | off |
| **CONNECTED_CAPTURE_ON** | false | — | **true** | true | false | **ON** |

- **showConnectView** — If true, render the connect flow (Connect button / QR); if false, render the two tabs (Capture, Vault).
- **connectStage** — For ConnectView: `"disconnected"` (show Connect) or `"connecting"` (show QR / progress).
- **vaultTabDisabled** — If true, the Vault tab trigger is disabled (user must Deactivate in Capture first).
- **captureActiveForUI** — Whether to show “Deactivate” and treat Capture as active for layout (disable Vault). Only true when paired and captureActive.
- **clearCaptureInBackground** — When true, popup sends `CAPTURE_DEACTIVATE` to the background so the badge is cleared and we never show “ON” while disconnected.

Badge (toolbar icon): background script shows “ON” when capture is active (in-memory). It is cleared when we send CAPTURE_DEACTIVATE (so when popup is open and state is DISCONNECTED or CONNECTING we clear it) or when the captured tab closes / browser restarts.

**Which state controls the badge:** The **only** state in which the badge is shown is **CONNECTED_CAPTURE_ON**. In every other state (DISCONNECTED, CONNECTING, CONNECTED_CAPTURE_OFF) the badge is off. So: not disconnected, and capture must be active. **Who controls it:** The **background** script holds capture state in memory (`captureActive`, `captureTabId`). It sets the badge when `captureActive` is true and clears it when capture is deactivated. **When the badge disappears:** (1) DISCONNECTED or CONNECTING — popup sends `CAPTURE_DEACTIVATE` (`clearCaptureInBackground` is true), so the background clears capture and removes the badge; (2) CONNECTED_CAPTURE_OFF — user deactivated, background already cleared; (3) captured tab closed — background clears in `tabs.onRemoved`; (4) browser restart — background state is lost. So the badge is the visible reflection of “capture is on and we’re connected”; if we’re disconnected, the badge is always off.

---

## Popup structure and tabs

**While disconnected:** the popup shows a single Connect surface (QR/connect view). No tabs.

**After connection:** the popup shows two tabs, **Capture** and **Vault**, in that order.

- **Default tab is Capture.** Most users will land here for the streamlined login flow. Vault is the intentional switch when you need full manual control (multi-page sign-in, recovery codes, tokens, credential files, custom security flows).
- **Capture tab:** User clicks **Activate** to start watching the current tab for credential-like fields (consent + scoping). Same payload shape as the vault, but autopopulated from heuristics. **Deactivate** only via the three scenarios below (explicit click, 60s idle, or Save on post-navigation prompt). Capture state is **in-memory only** and does **not** survive browser restart or closure of the captured tab. While Capture is **active**, the **Vault** tab is **disabled** in the popup — you must Deactivate first, then you can open Vault. That keeps “watching for credentials” and “editing vault manually” from being mixed in one flow.
- **Vault tab:** Full manual control over vault entries (create/update/search). Same as the current extension: same JSON payload shape; user edits group, website, description, attributes. There is no Activate/Deactivate in Vault. When connected and using the extension, session persistence applies: the extension can stay active across navigations so the session does not drop mid-flow. So Vault behaves like “always allowed to retreat to background” for session persistence — no toggle, just “you’re connected.”

**Single “active” state.** We are not juggling two activation modes. Only Capture has an explicit “active” (user clicked Activate). That one boolean drives: (1) popup UI — while Capture is active, the Vault tab trigger is disabled; (2) later, content script / badge — when Capture is active, “retreat to background” and badge apply; when the user is in Vault, session persistence is the same idea but without a toggle. Mental model: one boolean, one rule (if Capture active, can’t switch to Vault until Deactivate). Implementation: a single `captureActive` in the popup and, when we add it, coordination with the background script for badge/session.

Connection to the mobile device is a shared prerequisite: both tabs work only after the initial connect. The UI expresses this by structure (no tabs before connection), not explanatory text. Which view (connect vs tabs) and whether Vault is disabled are derived from the **Popup state machine** (see above).

**Implementation note:** Popup behavior (when to show connect vs tabs, when to disable Vault, when to clear the badge) is driven by a small state machine in `client/lib/extension-state.ts`. States: `DISCONNECTED`, `CONNECTING`, `CONNECTED_CAPTURE_OFF`, `CONNECTED_CAPTURE_ON`. All derivation (UI flags, side effects like “clear capture when disconnected”) lives there so the rules stay in one place and are easy to extend.

---

## Capture payload shape

When capture runs, the payload sent to the vault uses the existing JSON shape:

- **group** → site domain (e.g. `example.com`)
- **website** → full site URL (e.g. `https://example.com/login`)
- **description** → blank (or optional future heuristic)
- **attributes** → array of `{ key, value, isSecret? }`: one entry for the identifier (e.g. `username`, `email`), one for the secret (e.g. `password`). Field names from the page or heuristics when possible.

No new schema; only the source of the values changes (heuristics + current URL instead of manual form).

---

## Activation and “retreat to background”

- **When capture is not activated:** Behavior matches current extension (no special “retreat”; connection/session rules unchanged).
- **When capture is activated:** If the user navigates to another tab (or another URL in the same tab), the extension does not deactivate. It “retreats to the background”: the capture session stays active so the user can return and continue (e.g. complete sign-in, then get the save prompt).
- **Vault:** The same “retreat” idea applies when the user relies on the Vault tab for a complex flow — the extension can stay active across navigations so the session does not drop mid-flow.

---

## Badge when active in background

When the extension has retreated to the background (capture or vault session still active, user on another tab), it must show a **visible badge** so the user knows it is still on:

- Clearly “active” (e.g. fire emoji, or luminous green halo, or similar).
- Not dull or easy to miss.
- Exact design (icon/emoji/color) is implementer choice within “colorful and noticeable.”

---

## Deactivate (end of capture session)

Capture session ends **only** in these three cases:

1. **Explicit deactivate** — User clicks Deactivate (or equivalent) in the popup.
2. **60 seconds idle** — No relevant activity (e.g. no input/watch events) for 60 seconds → automatic deactivate.
3. **Save on post-navigation prompt** — After a successful login/sign-in the user is often redirected (e.g. to dashboard). The extension shows a “Save these credentials?”-style popup (similar to Chrome’s “Save password?”). If the user clicks **Save**, that action **also** deactivates the session (credentials are saved; session ends).

Closing the **captured tab** or restarting the browser also ends capture (state is in-memory only). **Switching** to another tab does not end capture — the session stays active so the user can return (retreat to background). No other event (e.g. navigation alone within the tab) deactivates an active capture session.

---

## Why keep both tabs

- **Capture:** Simple login/sign-in; low effort; heuristics + autopopulated payload; explicit Activate and the three deactivate conditions; Vault tab disabled while active.
- **Vault:** Complex flows (multi-page, recovery codes, tokens, credential files). Full control over the same JSON shape. Session persists when connected; no Activate/Deactivate.

---

## Out of scope

- Changes to A1 (mobile app) or R1 (relay) protocols or behavior.
- Changes to the encrypted vault payload schema (only who fills it: user vs heuristics).
- Exact UI/UX details (layouts, copy, visuals) except where stated (badge, two tabs, deactivate conditions).

---

## Definitions

- **Activate:** User action that starts “watching” the current tab for credential-like fields and scopes heuristics to that tab only; implies consent to watch inputs.
- **Deactivate:** End of the current capture session (badge off, no more watching that session).
- **Retreat to background:** Session stays active but user has left the tab; extension shows the “active” badge and does not end the session.
- **Capture:** The streamlined, heuristic-driven flow for login/sign-in (Capture tab).
- **Vault:** The full manual vault UI (Vault tab), same as current extension capabilities.

---

## Roadmap & milestones

### Done

| Milestone | Description |
|-----------|-------------|
| **Relay in background** | WebSocket and relay logic run in the service worker; connection survives popup close and tab switch. |
| **Popup state over messages** | Popup is state-driven: reducer receives actions via `chrome.runtime.onMessage`, sends commands via `sendMessage`. No shared memory with background. |
| **Explicit Disconnect** | User can disconnect the relay from the popup; WebSocket is closed in background. |
| **Badge for relay** | Extension icon shows relay connection state (e.g. ● when connected) even when popup is closed. |
| **Popup state machine** | States: DISCONNECTED, CONNECTING, CONNECTED_CAPTURE_OFF, CONNECTED_CAPTURE_ON. Capture activate/deactivate; Vault tab disabled while Capture active. |
| **Capture tab shell** | Capture tab with Activate/Deactivate; badge "ON" when capture active (in-memory in background). |

### Next

| Milestone | Description |
|-----------|-------------|
| **Capture heuristics** | Watch active tab for credential-like fields; scope to that tab; build payload (group, website, description, attributes) from heuristics + current URL. |
| **60s idle deactivate** | No relevant activity for 60 seconds → automatic deactivate and clear badge. |
| **Save-on-redirect prompt** | After navigation (e.g. post-login redirect), show “Save these credentials?”; Save action also deactivates the session. |
| **Retreat-to-background** | When user switches tab, capture session stays active; badge remains so user knows extension is still on; return to tab to continue. |

### Later

| Milestone | Description |
|-----------|-------------|
| **Content script for capture** | Inject into captured tab to read/detect fields and support save prompt (when in scope). |
| **Badge/icon polish** | Finalize “active” badge design (e.g. color, icon) per spec. |
