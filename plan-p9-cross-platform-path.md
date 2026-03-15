# P9: Cross-platform tasksDir Default Path

## Problem (Issue #25)

Mac users hit path resolution failures because the default `data/tasks` is relative
and `path.resolve()` depends on CWD, which varies by launch method (systemd, launchd,
Docker, manual).

## Solution

Change the default `tasksDir` from `"data/tasks"` to `~/.openclaw/a2a-tasks/`
(using `os.homedir()` to build an absolute path). User-configured paths still take
precedence. Existing relative-path configs remain functional (backward compat).

## Changes

### 1. `index.ts` — default path logic

- Add `import os from "node:os";`
- Line 176: change fallback from `"data/tasks"` to `path.join(os.homedir(), ".openclaw", "a2a-tasks")`
- `resolveConfiguredPath` function itself stays unchanged — it already handles:
  - User provides absolute path → use as-is
  - User provides relative path → resolve via `resolvePath` or `path.resolve()`
  - User provides nothing → use the new default (now absolute)

```typescript
// Before
tasksDir: resolveConfiguredPath(storage.tasksDir, "data/tasks", resolvePath),

// After
tasksDir: resolveConfiguredPath(
  storage.tasksDir,
  path.join(os.homedir(), ".openclaw", "a2a-tasks"),
  resolvePath,
),
```

### 2. `openclaw.plugin.json` — update schema default

```json
// Before
"tasksDir": { "type": "string", "default": "data/tasks" },

// After
"tasksDir": { "type": "string", "default": "~/.openclaw/a2a-tasks" },
```

### 3. `tests/cross-platform-path.test.ts` — new test file

Three test cases:

1. **Default path** — no `storage.tasksDir` configured → resolves to `~/.openclaw/a2a-tasks`
2. **Custom absolute path** — user sets `/tmp/my-tasks` → uses exactly that
3. **Relative path backward compat** — user sets `data/tasks` → resolves to absolute (CWD-based)

Implementation: export `parseConfig` (or test via plugin harness + inspect logged path).
Simplest approach: make `parseConfig` a named export, call it directly in tests.

### 4. `README.md` — update config table

```
| `storage.tasksDir` | string | `~/.openclaw/a2a-tasks` | Durable on-disk task store path |
```

Remove the roadmap bullet about this feature (it's now implemented).

### 5. `README_CN.md` — same updates in Chinese

```
| `storage.tasksDir` | string | `~/.openclaw/a2a-tasks` | 磁盘持久化任务目录 |
```

Remove roadmap bullet.

## Risk Assessment

- **Low risk**: `FileTaskStore` already does `path.resolve()` + `mkdir recursive`
- **Backward compat**: if user has `storage.tasksDir: "data/tasks"` in config, it still works
  (resolveConfiguredPath detects non-empty user value and uses it)
- **No data migration needed**: users with existing `data/tasks` data keep their config;
  only the *default* changes for new installs

## Testing

```bash
npx tsx --test tests/cross-platform-path.test.ts
npx tsx --test tests/*.test.ts  # full suite regression
```
