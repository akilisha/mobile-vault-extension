# Roadmap — Capture + Vault vision

Execution order: work through phases in sequence. Within each phase, pick milestones from `MILESTONES.md` one at a time.

---

## Phase 1 — Popup structure and Capture tab shell

- Add a second tab to the popup: **Vault** (current UI) and **Capture** (new).
- Capture tab is a dedicated shell: Activate / Deactivate, status, and placeholder for future heuristic UI. No heuristics yet.
- Ensure existing Vault tab and relay/vault behavior are unchanged.

**Outcome:** User sees two tabs; Capture tab exists and can show “Activate” and state; no change to current vault or connection logic.

---

## Phase 2 — Activation, session, and “retreat to background”

- **Activate** starts a capture session for the current tab only (store tab/session state in background).
- When the user switches tab or navigates: do **not** end the session; treat as “retreat to background.”
- When capture is active and in background, show a **visible badge** (e.g. fire emoji or luminous green) so the user knows the extension is still on.
- Only **Deactivate** (explicit, idle timeout, or save-on-prompt) ends the session and clears the badge.

**Outcome:** Activate/Deactivate work; session survives tab switch and navigation; badge appears when active in background.

---

## Phase 3 — Deactivate conditions

- **Explicit deactivate:** User clicks Deactivate in Capture tab → end session, clear badge.
- **60s idle:** If no relevant activity for 60 seconds while capture is active → auto deactivate.
- **Save on post-navigation prompt:** After navigation (e.g. post-login redirect), show a “Save these credentials?”-style popup; on **Save**, persist to vault (existing save path) and then deactivate the session.

**Outcome:** All three deactivate paths implemented and tested.

---

## Phase 4 — Heuristics and autopopulated payload (Capture)

- On the activated tab, run heuristics to detect credential-like fields (e.g. username/email, password).
- On capture (e.g. form submit or explicit “Capture”): build the existing vault payload shape with:
  - **group** = current site domain
  - **website** = current page URL
  - **description** = blank
  - **attributes** = inferred identifier field name + value, secret field name + value
- Send to vault via existing save path (same JSON shape as Vault tab).

**Outcome:** Capture tab can infer and save credentials without the user filling the vault form; payload shape unchanged.

---

## Phase 5 — Fill and save prompt flow

- When capture is active and credentials exist for the current site (from vault): offer to fill (or show for copy).
- When user navigates after a likely successful login (e.g. URL change, same origin or known pattern): show “Save these credentials?” prompt; on Save, use autopopulated payload and existing save, then deactivate.

**Outcome:** Fill-from-vault and save-on-navigation prompt integrated with Capture session and deactivate rules.

---

## Phase 6 — Vault tab: optional “stay active” across navigation

- For Vault-tab-driven flows (complex, multi-page): allow the session to “retreat to background” instead of disconnecting on tab/navigation change, and show the same “active” badge when in background.
- Clarify in UI when the extension is “on” for vault vs capture (e.g. badge + tab state).

**Outcome:** Both Capture and Vault can persist across navigation where needed; badge and deactivate rules stay consistent.

---

## Phase 7 — Polish and edge cases

- Copy, error handling, and edge cases (e.g. multiple forms, iframes, strict sites).
- Optional: configurable idle timeout, badge style (emoji vs halo).
- Documentation and release prep.

**Outcome:** Production-ready behavior and docs.
