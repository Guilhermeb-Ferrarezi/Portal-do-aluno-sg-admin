# Codex SSE Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream Codex assistant text to the drawer in real time through SSE instead of polling the thread repeatedly.

**Architecture:** The API will expose a thread-scoped SSE endpoint that emits assistant draft updates and final completion events for the active run. The existing Codex runner already persists partial assistant drafts; the drawer will subscribe with `EventSource`, merge incoming events into local state, and close the stream when the run finishes, errors, or the user switches threads.

**Tech Stack:** Bun, Express, TypeScript, React, SSE via `text/event-stream`, existing AI thread service, existing Codex drawer UI.

---

### Task 1: Add a thread SSE endpoint in the AI router

**Files:**
- Modify: `api/src/routes/ai.ts`
- Modify: `api/src/lib/ai-chat.ts`
- Test: `api/test/aiStreaming.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("streams assistant draft updates over SSE for the active thread", async () => {
  // Assert: GET /api/ai/threads/:id/stream returns text/event-stream
  // and emits at least one assistant draft event before the final done event.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test api/test/aiStreaming.test.ts`
Expected: FAIL because the SSE endpoint does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
router.get("/ai/threads/:threadId/stream", authGuard(jwtSecret), async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send events from the active run/draft rows for this thread.
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test api/test/aiStreaming.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/ai.ts api/src/lib/ai-chat.ts api/test/aiStreaming.test.ts
git commit -m "feat: stream codex progress via sse"
```

### Task 2: Replace drawer polling with EventSource

**Files:**
- Modify: `web/src/components/AI/CodexDrawer.tsx`
- Test: `web/src/components/AI/CodexDrawer.tsx` via build verification

- [ ] **Step 1: Write the failing test**

```ts
// The drawer should render streaming assistant text from the active thread
// without waiting for the final POST response.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run build`
Expected: the code still compiles before the SSE wiring is added, but the manual behavior is not present yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
const streamSourceRef = React.useRef<EventSource | null>(null);

React.useEffect(() => {
  if (!open || !selectedThreadId || !sending || !codexAuthenticated) return;
  const source = new EventSource(`/api/ai/threads/${selectedThreadId}/stream`);
  streamSourceRef.current = source;
  source.addEventListener("draft", (event) => {
    // merge draft into threadDetail
  });
  source.addEventListener("done", () => source.close());
  source.addEventListener("error", () => source.close());
  return () => source.close();
}, [open, selectedThreadId, sending, codexAuthenticated]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run build`
Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AI/CodexDrawer.tsx
git commit -m "feat: subscribe codex drawer to sse"
```

### Task 3: Remove the old polling loop and clean up stream lifecycle

**Files:**
- Modify: `web/src/components/AI/CodexDrawer.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// Ensure the drawer no longer schedules interval polling for thread refresh
// while a stream is active.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run build`
Expected: build still succeeds, but the old polling path remains in the UI.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Remove streamPollRef, startThreadStreamRefresh, and stopThreadStreamRefresh.
// Close EventSource on unmount, thread change, send completion, and interrupt.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AI/CodexDrawer.tsx
git commit -m "refactor: remove codex polling loop"
```

### Task 4: Verify the full flow end to end

**Files:**
- Modify: none
- Test: `api/test/aiStreaming.test.ts`, `bun run build` in `api`, `bun run build` in `web`

- [ ] **Step 1: Write the failing test**

```bash
bun test api/test/aiStreaming.test.ts
```

- [ ] **Step 2: Run test to verify it fails**

Expected: fail only if SSE event wiring is incomplete.

- [ ] **Step 3: Write minimal implementation**

```bash
# Fix any mismatches in event names, JSON payloads, or cleanup logic.
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
bun test api/test/aiStreaming.test.ts
bun run build
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/routes/ai.ts api/src/lib/ai-chat.ts web/src/components/AI/CodexDrawer.tsx api/test/aiStreaming.test.ts
git commit -m "fix: finish codex sse streaming flow"
```

