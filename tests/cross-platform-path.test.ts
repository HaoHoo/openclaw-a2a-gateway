import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { parseConfig } from "../index.js";

describe("cross-platform tasksDir default (issue #25)", () => {
  it("uses ~/.openclaw/a2a-tasks when no tasksDir is configured", () => {
    const config = parseConfig({});
    const expected = path.join(os.homedir(), ".openclaw", "a2a-tasks");
    assert.equal(config.storage.tasksDir, expected);
  });

  it("respects user-configured absolute path", () => {
    const config = parseConfig({
      storage: { tasksDir: "/tmp/my-custom-tasks" },
    });
    assert.equal(config.storage.tasksDir, "/tmp/my-custom-tasks");
  });

  it("resolves user-configured relative path (backward compat)", () => {
    const config = parseConfig({
      storage: { tasksDir: "data/tasks" },
    });
    // Should resolve to an absolute path based on CWD
    assert.ok(
      path.isAbsolute(config.storage.tasksDir),
      `tasksDir should be absolute but got "${config.storage.tasksDir}"`,
    );
    assert.ok(
      config.storage.tasksDir.endsWith("data/tasks"),
      `should end with "data/tasks" but got "${config.storage.tasksDir}"`,
    );
  });

  it("uses resolvePath callback when provided", () => {
    const config = parseConfig({}, (p: string) => `/custom/base/${p}`);
    // Default path is already absolute (~/.openclaw/a2a-tasks), so resolvePath
    // should still be called but the result is absolute → used as-is
    assert.ok(
      path.isAbsolute(config.storage.tasksDir),
      "tasksDir should be absolute",
    );
  });

  it("resolvePath transforms user-configured relative path", () => {
    const config = parseConfig(
      { storage: { tasksDir: "my/tasks" } },
      (p: string) => `/plugin-root/${p}`,
    );
    assert.equal(config.storage.tasksDir, "/plugin-root/my/tasks");
  });
});
