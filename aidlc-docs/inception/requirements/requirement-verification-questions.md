# Requirements Clarification — Notification Reset on Bell Click

Please answer each question by filling in the letter choice after the `[Answer]:` tag.

---

## Question 1

When the bell icon is clicked, what should happen to the currently unread notifications in the database?

A) Mark all UNREAD notifications as **READ** permanently — the badge drops to 0 and the "mark all as read" button inside the popover becomes redundant (standard pattern: Gmail, Slack, etc.)

B) Keep the DB status unchanged — just store a **"last seen at"** timestamp and only count notifications created _after_ that timestamp as new (preserves UNREAD status for reference, more complex to implement)

[Answer]: A

---

## Question 2

Should the existing **"mark all as read" button** (checkmark icon in the popover header) be kept or removed after this change?

A) Remove it — clicking the bell already does the same thing

B) Keep it — it may still be useful if the admin wants to manually trigger it without having to close and reopen the popover

[Answer]: A

---

## Question 3

Should security extension rules be enforced for this change?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)

B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4

Should the resiliency baseline be applied to this change?

A) Yes — apply the resiliency baseline as directional best practices

B) No — skip the resiliency baseline (suitable for a simple UI enhancement)

[Answer]: A

---

## Question 5

Should property-based testing rules be enforced for this change?

A) Yes — enforce all PBT rules as blocking constraints

B) No — skip all PBT rules (suitable for a UI-only interaction change)

[Answer]: A
