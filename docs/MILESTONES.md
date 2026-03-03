# Milestones — Capture + Vault vision

Pick one milestone at a time; implement and verify before moving to the next. Each maps to a phase in `ROADMAP.md`.

---

## Phase 1 — Popup structure and Capture tab shell

| ID   | Milestone | Done | Notes |
|------|-----------|------|--------|
| 1.1  | Add tab strip to popup: "Vault" and "Capture". Default or open state is Vault (current UI). | ☑ | No behavior change to existing Vault content. |
| 1.2  | Capture tab content: heading, "Activate" button (disabled or no-op for now), short description (e.g. "Watch this tab for login fields"). No relay/vault logic changes. | ☑ | Shell only. |
| 1.3  | Ensure Vault tab still loads and works exactly as today (relay, readAll, save, remove, search). | ☑ | Regression check. |

---

## Phase 2 — Activation, session, retreat, badge

| ID   | Milestone | Done | Notes |
|------|-----------|------|--------|
| 2.1  | Background: capture session state (active tab id, activated at timestamp). Activate sets state; Deactivate clears it. | ☐ | Persist in memory or storage as needed. |
| 2.2  | On tab change or navigation: if capture is active for that tab, do not clear session; treat as "retreat to background." | ☐ | Remove or bypass any "clear on navigate" logic for capture. |
| 2.3  | When capture session is active and user is not on the activated tab (or has navigated): set extension badge to a visible "on" state (e.g. fire emoji 🔥 or green halo). When deactivated or user back on tab, clear or update badge. | ☐ | chrome.action.setBadgeText / setBadgeBackgroundColor or icon. |
| 2.4  | Capture tab shows current state: "Active" vs "Inactive" and, when active, a "Deactivate" button that clears session and badge. | ☐ | UI reflects 2.1–2.3. |

---

## Phase 3 — Deactivate conditions

| ID   | Milestone | Done | Notes |
|------|-----------|------|--------|
| 3.1  | Explicit Deactivate: button in Capture tab clears session, clears badge, updates UI. | ☐ | May already be done in 2.4; confirm. |
| 3.2  | 60-second idle: timer starts when capture is activated; resets on relevant activity (e.g. input events on the tab). On expiry, deactivate session and clear badge. | ☐ | Define "relevant activity" (e.g. focus, input, form change). |
| 3.3  | Post-navigation save prompt: when user navigates (e.g. URL change) while capture is active, show a prompt "Save these credentials?" with Save / Dismiss. On Save: build payload (Phase 4 may provide heuristics; until then use placeholder or last-seen values), call existing save, then deactivate. On Dismiss: optionally deactivate or keep session; spec says Save deactivates. | ☐ | Prompt can be in-page or extension popup/toast; decide and document. |

---

## Phase 4 — Heuristics and autopopulated payload

| ID   | Milestone | Done | Notes |
|------|-----------|------|--------|
| 4.1  | Content script or injected logic on activated tab: detect inputs that look like identifier (username, email, etc.) and secret (password). Heuristics: type, name, id, aria, placeholders. | ☐ | Prefer minimal, robust rules; document in code or spec. |
| 4.2  | On capture event (e.g. form submit or explicit "Capture"): build payload with group = domain, website = URL, description = "", attributes = [ { key: inferred name, value: captured value, isSecret? } ]. Use existing vault save path (same JSON shape as Vault tab). | ☐ | Reuse ClientVault/relay save; no new schema. |
| 4.3  | Capture tab shows feedback when credentials were captured/saved (e.g. toast or inline message). | ☐ | UX polish. |

---

## Phase 5 — Fill and save prompt flow

| ID   | Milestone | Done | Notes |
|------|-----------|------|--------|
| 5.1  | When capture is active and vault has credentials for current site (readAll + filter by domain/URL): offer to fill or show for copy in Capture tab or in-page. | ☐ | Reuse existing vault read/fill if any; otherwise implement. |
| 5.2  | Post-navigation prompt (3.3) uses heuristics (4.1–4.2) to build the payload when user clicks Save. | ☐ | Wire 3.3 to 4.2. |
| 5.3  | Edge cases: multiple forms, iframe, same-origin redirect vs cross-origin. Document or handle. | ☐ | At least document limits. |

---

## Phase 6 — Vault tab: stay active across navigation

| ID   | Milestone | Done | Notes |
|------|-----------|------|--------|
| 6.1  | Optional mode or explicit "Stay active" when using Vault tab for a multi-page flow: do not disconnect or clear session on tab/navigation; show same "active" badge when in background. | ☐ | May reuse same badge and session abstraction as capture. |
| 6.2  | UI distinguishes "active for Capture" vs "active for Vault" if needed (e.g. badge tooltip or tab state). | ☐ | Optional clarity. |

---

## Phase 7 — Polish and edge cases

| ID   | Milestone | Done | Notes |
|------|-----------|------|--------|
| 7.1  | Copy and error handling: clear messages, retry, offline. | ☐ | |
| 7.2  | Optional: configurable idle timeout (default 60s), badge style (emoji vs color). | ☐ | |
| 7.3  | Update EXTENSION_SETUP.md / EXTENSION_BUILD.md and any user-facing docs with Capture tab and deactivate rules. | ☐ | |

---

## How to use this list

1. Open `ROADMAP.md` and pick the current phase.
2. In this file, pick the next unchecked milestone in that phase.
3. Implement and test; mark Done (☑) when verified.
4. If a milestone blocks another, reorder or split; keep the table updated.
5. Reference `docs/CAPTURE-VISION-SPEC.md` for any ambiguity.
