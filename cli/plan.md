# Phase 4: A2A DevTools CLI — Implementation Plan

## 第一个 PR 范围（Phase 1 + 2）

### 目录结构
```
cli/
  package.json          # @openclaw/a2a-cli
  tsconfig.json
  bin/a2a.ts            # 入口 (Commander.js)
  src/
    commands/
      health.ts         # 移植 a2a-ping.mjs + metrics
      send.ts           # 移植 a2a-send.mjs
      status.ts         # 移植 a2a-status.mjs
      card.ts           # 新：获取 Agent Card
    lib/
      peers.ts          # 移植 a2a-peers.mjs → TypeScript
      client-factory.ts # 共享 SDK 客户端构建
      format.ts         # chalk + cli-table3 格式化
  tests/
    peers.test.ts
```

### 实施顺序
1. package.json + tsconfig.json
2. lib/peers.ts + lib/client-factory.ts + lib/format.ts
3. bin/a2a.ts (Commander 骨架)
4. commands/health.ts (最简单，先跑通)
5. commands/card.ts (新命令，纯展示)
6. commands/send.ts + commands/status.ts (移植)
7. tests + tsc 验证

### 验收标准
- `npx tsx cli/bin/a2a.ts --help` 显示所有命令
- `a2a health AntiBot` / `a2a health --all` 工作
- `a2a card http://localhost:18800` 工作
- `a2a send AntiBot "hello"` 工作
- `a2a status AntiBot <task-id>` 工作
- `--json` + `--no-color` 全局生效
- tests 通过
