---
name: LinkedIn job app scope
description: The user's current scope boundary for the LinkedIn jobs product.
---

Keep the current LinkedIn jobs product lightweight; the user said they want to work on a full-fledged app later.

**Why:** The user explicitly set this as the current scope.

**How to apply:** Focus on core job search, timing, freshness sorting, and coverage. Defer broader product features until explicitly requested.

As automatically fetched pages arrive, immediately resort jobs newest first while preserving the visible job card's screen position; do not queue result updates for a later tap.

**Why:** The user chose immediate resorting, but does not want incoming results to move the job they are currently reading off-screen.

**How to apply:** When pagination changes list order, anchor the currently visible job card and compensate scroll position after the DOM update.
