# Capture + Vault vision — product spec

## 1. Purpose

Lower the barrier to using the extension by reducing manual effort for the common case (login/sign-in capture and fill) while keeping full vault control for complex flows. Two modes live side by side: **Capture** (heuristic, semi-automatic) and **Vault** (manual, full control).

---

## 2. User problems

- **Manual flow kills adoption:** Creating credentials in the vault (or on the phone) and copying them into the host page (or vice versa) is tedious. Benefit does not outweigh the effort.
- **Complex flows need full control:** Some sites use multi-page sign-in, recovery codes, tokens, or credential files. For these, the user needs the full vault inside the extension, not just a simplified capture flow.
- **Session dropping on navigation:** If the user navigates away from the tab (e.g. to check email for a code), the extension currently deactivates. For both capture and complex vault use, the session should be able to persist until the user explicitly ends it or a defined timeout/save condition occurs.

---

## 3. Product requirements

### 3.1 Two tabs in the popup

**While disconnected:** popup shows a single \"Connect\" surface (existing QR/connect view). No tabs.

**After connection:** popup shows two tabs:

| Tab        | Purpose | Behavior |
|-----------|---------|----------|
| **Vault** | Full manual control over vault entries (create/update/search). For complex flows: multi-page sign-in, recovery codes, tokens, credential files, custom security flows. | Same as current extension. Same JSON payload shape. User edits group, website, description, attributes. Extension may stay active when user navigates away (session persists). |
| **Capture** | Streamlined login/sign-in: heuristics infer credential fields; payload is autopopulated; minimal user input. | Explicit **Activate** to watch the current tab only (consent + scoping). Same payload shape as vault, but autopopulated. **Deactivate** only via the three scenarios below. |

Connection to the mobile device is a shared prerequisite: both tabs work only after the initial connect, but the UI expresses this by structure (no tabs before connection), not explanatory text.

### 3.2 Capture payload shape (unchanged schema, autopopulated)

When capture runs, the payload sent to the vault uses the existing JSON shape:

- **group** → site domain (e.g. `example.com`)
- **website** → full site URL (e.g. `https://example.com/login`)
- **description** → blank (or optional future heuristic)
- **attributes** → array of `{ key, value, isSecret? }`:
  - One entry for the identifier (e.g. `username`, `email`) → captured value
  - One entry for the secret (e.g. `password`) → captured value  
  Field names are taken from the page (or heuristics) when possible.

No new schema; only the source of the values changes (heuristics + current URL instead of manual form).

### 3.3 Activation and “retreat to background”

- **When capture is not activated:** Behavior matches current extension (no special “retreat”; connection/session rules unchanged).
- **When capture is activated:** If the user navigates to another tab (or another URL in the same tab), the extension **does not** deactivate. It “retreats to the background”: the capture session stays active so the user can return and continue (e.g. complete sign-in, then get the save prompt).
- The same “retreat” idea applies when the user relies on the **Vault** tab for a complex flow: the extension can stay active across navigations so the session does not drop mid-flow.

### 3.4 Badge when active in background

When the extension has retreated to the background (capture or vault session still active, user on another tab), it must show a **visible badge** so the user knows it is still on. Requirements:

- Clearly “active” (e.g. fire emoji, or luminous green halo, or similar).
- Not dull or easy to miss.
- Exact design (icon/emoji/color) is implementer choice within “colorful and noticeable.”

### 3.5 Deactivate (end of capture session)

Capture session ends **only** in these three cases:

1. **Explicit deactivate** — User clicks Deactivate (or equivalent) in the popup.
2. **60 seconds idle** — No relevant activity (e.g. no input/watch events) for 60 seconds → automatic deactivate.
3. **Save on post-navigation prompt** — After a successful login/sign-in the user is often redirected (e.g. to dashboard). The extension shows a “Save these credentials?”-style popup (similar to Chrome’s “Save password?”). If the user clicks **Save**, that action **also** deactivates the session (credentials are saved; session ends).

No other event (e.g. tab switch, navigation alone) deactivates an active capture session.

### 3.6 Why keep both tabs

- **Capture tab:** Simple login/sign-in; low effort; heuristics + autopopulated payload; explicit Activate and the three deactivate conditions.
- **Vault tab:** Complex flows (multi-page, recovery codes, tokens, credential files, inane security). Full control over the same JSON shape. Extension can stay active across navigations when the user is in the middle of such a flow.

---

## 4. Out of scope for this spec

- Changes to A1 (mobile app) or R1 (relay) protocols or behavior.
- Changes to the encrypted vault payload schema (only who fills it: user vs heuristics).
- Exact UI/UX details (layouts, copy, visuals) except where stated (badge, two tabs, deactivate conditions).

---

## 5. Definitions

- **Activate:** User action that starts “watching” the current tab for credential-like fields and scopes heuristics to that tab only; implies consent to watch inputs.
- **Deactivate:** End of the current capture session (badge off, no more watching that session).
- **Retreat to background:** Session stays active but user has left the tab; extension shows the “active” badge and does not end the session.
- **Capture:** The streamlined, heuristic-driven flow for login/sign-in (Capture tab).
- **Vault:** The full manual vault UI (Vault tab), same as current extension capabilities.
