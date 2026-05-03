# `openclaw-a2a-gateway` Copilot 中文指引

## 构建、测试、类型检查命令

先在仓库根目录执行 `npm install`。根包依赖 `tsx`、`typescript` 等开发依赖；如果只装了生产依赖，测试和类型检查不会运行。

| 范围 | 命令 | 说明 |
| --- | --- | --- |
| 根插件 | `npm test` | 运行完整网关测试集。 |
| 根插件 | `./node_modules/.bin/tsc --noEmit` | CI 使用的类型检查命令。 |
| 根插件 | `node --import tsx --test tests/a2a-gateway.test.ts` | 运行单个测试文件。 |
| 根插件 | `node --import tsx --test --test-name-pattern='zero-config' tests/a2a-gateway.test.ts` | 运行单个命名测试。 |
| 根插件 | `node --import tsx --test tests/benchmark.test.ts` | 运行 README 中提到的 bio-inspired 基准测试。 |
| CLI 子包 | `cd cli && npm install` | 安装 CLI 子包依赖。 |
| CLI 子包 | `cd cli && npm run build` | 构建独立的 `a2a` 调试 CLI。 |
| CLI 子包 | `cd cli && npm test` | 运行 CLI 子包测试。 |

> 当前仓库未发现独立的 lint 脚本；CI 主要执行类型检查和测试。

## 高层架构

- `index.ts` 是插件入口，也是运行时的 composition root。它负责解析配置、创建 manager/store、注册 OpenClaw gateway 方法、注册 `a2a_send_file` 工具、挂载 Express A2A 路由，并启动 gRPC 服务。
- 入站 A2A 请求通过 `@a2a-js/sdk` 的 `DefaultRequestHandler` 进入系统，底层由 `FileTaskStore` 持久化任务、由 `QueueingAgentExecutor` 处理并发、排队和可选软限流。
- `OpenClawAgentExecutor` 负责把 A2A 任务桥接到 OpenClaw 网关 RPC：把 `TextPart` / `FilePart` / `DataPart` 转为 agent 可读文本，并把 agent 返回的 `mediaUrl` / `mediaUrls` 重新提升为 A2A `FilePart`。
- 出站到其他 peer 的调用统一经过 `src/client.ts`，会先解析 Agent Card，再按 JSON-RPC -> REST -> gRPC 顺序尝试传输；如果收集到了每个 peer 的近期成功率和延迟，还会自适应调整优先级。
- 发现和韧性能力拆在多个模块中：`peer-health.ts`、`peer-retry.ts`、`dns-discovery.ts`、`quorum-discovery.ts`、`dns-responder.ts`。
- 可观测性和持久化是主路径的一部分，而不是附属功能：`telemetry.ts`、`audit.ts`、`push-notifications.ts`、`task-recovery.ts`、`task-cleanup.ts` 会在插件启动/运行期间持续参与。
- `src/internal/*` 明确表示 OpenClaw 网关网格扩展，不是标准 A2A 协议公共面。
- `cli/` 是独立 npm package；只要改到它，就要把它当成单独构建/测试面处理。

## 关键约定

- 这是严格的 TypeScript ESM 项目；即使在 `.ts` 文件里也保持 `.js` import specifier。
- 配置变更必须同时修改 `openclaw.plugin.json` 和 `index.ts` 里的 `parseConfig()`；只改 schema 不够，只改运行时解析也不够。
- 所有 bio-inspired 能力都应保持“可选、增量、向后兼容”；未配置时不应破坏标准/旧行为。
- 静态 peers 与发现到的 peers 会合并，且静态 peers 在重名时优先。
- 文件/URL 安全校验必须复用 `file-security.ts`，不要自己重新写一套；该模块默认 fail-closed，并且避免验证后再次解析 URL 带来的 DNS rebinding 风险。
- 任务是落盘到 `storage.tasksDir` 下的 JSON 文件；改动任务流转时通常需要一起检查 `task-store.ts`、`task-recovery.ts`、`task-cleanup.ts`。
- 测试框架使用 Node 原生 `node:test` + `assert/strict`，共享测试夹具在 `tests/helpers.ts`，不要引入 Jest/Vitest 风格写法。
- gRPC 启动失败被视为非致命；HTTP/JSON-RPC/REST 仍应能启动成功。
