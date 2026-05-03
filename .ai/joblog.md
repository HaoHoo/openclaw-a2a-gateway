# Job Log

## 2026-05-03 10:53:40 +08:00

### 修改主题

调整 A2A Gateway 的 gRPC 发布逻辑：

- **恢复默认监听逻辑**：本地 gRPC 服务仍按 `server.port + 1` 监听
- **新增发布覆盖配置**：增加 `agentCard.grpcUrl`
- **目标效果**：当 `plugins.entries.a2a-gateway.config.agentCard.grpcUrl` 存在时，`agent-card.json` 中发布的 GRPC URL 不再固定输出为 `host:port+1`，而可以是例如 `domain.com/grpc`

### 修改说明

这次修改把“本地监听端口”和“Agent Card 对外发布地址”分离：

1. **本地监听端口不变**
   - gRPC 运行时监听仍使用 `server.port + 1`
   - 没有新增新的运行时端口配置项

2. **Agent Card 增加可覆盖的 GRPC URL**
   - 新增 `agentCard.grpcUrl?: string`
   - 如果未配置，仍然发布默认值：`<host>:<port+1>`
   - 如果已配置，例如 `domain.com/grpc`，则 `agent-card.json` 中的 `additionalInterfaces[GRPC]` 使用该值

3. **同步更新的范围**
   - 配置 schema
   - 运行时配置解析
   - Agent Card 生成逻辑
   - 测试
   - README 与 Copilot 指引文档

### 影响文件

- `index.ts`
- `src/agent-card.ts`
- `src/types.ts`
- `openclaw.plugin.json`
- `tests/a2a-gateway.test.ts`
- `README.md`
- `.github/copilot-instructions.md`

### 配置示例

```json
{
  "plugins": {
    "entries": {
      "a2a-gateway": {
        "config": {
          "agentCard": {
            "url": "http://domain.com/a2a/jsonrpc",
            "grpcUrl": "domain.com/grpc"
          }
        }
      }
    }
  }
}
```

### 修改代码对照

#### 1. 配置解析：`index.ts`

**修改前**

```ts
return {
  name: asString(raw.name, "OpenClaw A2A Gateway"),
  description: asString(raw.description, "A2A bridge for OpenClaw agents"),
  url: asString(raw.url, ""),
  skills: skills.map((entry) => {
```

**修改后**

```ts
return {
  name: asString(raw.name, "OpenClaw A2A Gateway"),
  description: asString(raw.description, "A2A bridge for OpenClaw agents"),
  url: asString(raw.url, ""),
  grpcUrl: asString(raw.grpcUrl, ""),
  skills: skills.map((entry) => {
```

#### 2. Agent Card 生成：`src/agent-card.ts`

**修改前**

```ts
const configuredUrl = agentCard.url;
const grpcPort = server.port + 1;
const grpcHost = server.host === "0.0.0.0"
  ? (configuredUrl ? new URL(configuredUrl).hostname : "localhost")
  : server.host;

additionalInterfaces: [
  { url: configuredUrl || fallbackUrl, transport: "JSONRPC" },
  { url: `${new URL(configuredUrl || fallbackUrl).origin}/a2a/rest`, transport: "HTTP+JSON" },
  { url: `${grpcHost}:${grpcPort}`, transport: "GRPC" },
],
```

**修改后**

```ts
const configuredUrl = agentCard.url;
const configuredGrpcUrl = agentCard.grpcUrl;
const grpcPort = server.port + 1;
const grpcHost = server.host === "0.0.0.0"
  ? (configuredUrl ? new URL(configuredUrl).hostname : "localhost")
  : server.host;
const grpcUrl = configuredGrpcUrl || `${grpcHost}:${grpcPort}`;

additionalInterfaces: [
  { url: configuredUrl || fallbackUrl, transport: "JSONRPC" },
  { url: `${new URL(configuredUrl || fallbackUrl).origin}/a2a/rest`, transport: "HTTP+JSON" },
  { url: grpcUrl, transport: "GRPC" },
],
```

#### 3. 类型定义：`src/types.ts`

**修改前**

```ts
export interface AgentCardConfig {
  name: string;
  description?: string;
  url?: string;
  skills: Array<AgentSkillConfig | string>;
}
```

**修改后**

```ts
export interface AgentCardConfig {
  name: string;
  description?: string;
  url?: string;
  grpcUrl?: string;
  skills: Array<AgentSkillConfig | string>;
}
```

#### 4. 配置 Schema：`openclaw.plugin.json`

**修改前**

```json
"properties": {
  "name": { "type": "string" },
  "description": { "type": "string" },
  "url": { "type": "string" },
  "skills": {
```

**修改后**

```json
"properties": {
  "name": { "type": "string" },
  "description": { "type": "string" },
  "url": { "type": "string" },
  "grpcUrl": {
    "type": "string",
    "description": "Override the gRPC interface URL published in the Agent Card (for example: domain.com/grpc). Does not change the local gRPC listener port."
  },
  "skills": {
```

#### 5. 测试：`tests/a2a-gateway.test.ts`

**新增验证点**

```ts
it("defaults published gRPC URL to server.port + 1 when agentCard.grpcUrl is omitted", () => {
  // 默认仍发布 127.0.0.1:18801
});

it("uses configured agentCard.grpcUrl when provided", () => {
  // 配置后发布 domain.com/grpc
});
```

### 结果说明

- `agent-card.json` 现在支持通过 `agentCard.grpcUrl` 覆盖对外发布的 GRPC URL
- 本地实际 gRPC 服务端口逻辑未改变，仍为 `server.port + 1`
- 兼容旧配置：未配置 `agentCard.grpcUrl` 时行为保持不变
