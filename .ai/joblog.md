# Job Log

## 2026-05-03 12:01:03 +08:00

### 修改主题

调整 `agentCard.grpcUrl` 配置语义，改为**布尔开关**，并让 gRPC 发布地址与 JSON-RPC / REST 一样从基础 URL 推导。

### 修改说明

这次修改是在上一版 `grpcUrl` 实现基础上的收敛与简化：

1. **配置语义变化**
   - 原先：`agentCard.grpcUrl` 被当作字符串使用，需要手写完整 GRPC 地址
   - 现在：`agentCard.grpcUrl` 改为布尔值

2. **生成逻辑变化**
   - 当 `agentCard.grpcUrl` 未配置或为 `false` 时：
     - 继续沿用默认逻辑，发布 `<host>:<port+1>`
   - 当 `agentCard.grpcUrl` 为 `true` 时：
     - 直接复用现有 JSON-RPC / REST 使用的基础 URL
     - 从 `new URL(configuredUrl || fallbackUrl).origin` 推导
     - 最终生成 `${origin}/grpc`

3. **设计目标**
   - 不新增运行时监听配置
   - 不让用户手动写完整字符串 URL
   - 尽量复用现有 URL 生成逻辑，减少分支和额外变量

### 影响文件

- `src/agent-card.ts`
- `src/types.ts`
- `index.ts`
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
            "url": "http://127.0.0.1:18800/a2a/jsonrpc",
            "grpcUrl": true
          }
        }
      }
    }
  }
}
```

### 修改代码对照

#### 1. 类型定义：`src/types.ts`

**修改前**

```ts
export interface AgentCardConfig {
  name: string;
  description?: string;
  url?: string;
  grpcUrl?: string;
  skills: Array<AgentSkillConfig | string>;
}
```

**修改后**

```ts
export interface AgentCardConfig {
  name: string;
  description?: string;
  url?: string;
  grpcUrl?: boolean;
  skills: Array<AgentSkillConfig | string>;
}
```

#### 2. 配置解析：`index.ts`

**修改前**

```ts
grpcUrl: asString(raw.grpcUrl, ""),
```

**修改后**

```ts
grpcUrl: asBoolean(raw.grpcUrl, false),
```

#### 3. Agent Card gRPC 地址生成：`src/agent-card.ts`

**修改前**

```ts
const configuredGrpcUrl = agentCard.grpcUrl;
const grpcUrl = configuredGrpcUrl || `${grpcHost}:${grpcPort}`;
```

**修改后**

```ts
const useDerivedGrpcUrl = agentCard.grpcUrl === true;
const grpcUrl = useDerivedGrpcUrl
  ? `${new URL(configuredUrl || fallbackUrl).origin}/grpc`
  : `${grpcHost}:${grpcPort}`;
```

#### 4. 配置 Schema：`openclaw.plugin.json`

**修改前**

```json
"grpcUrl": {
  "type": "string",
  "description": "Override the gRPC interface URL published in the Agent Card..."
}
```

**修改后**

```json
"grpcUrl": {
  "type": "boolean",
  "description": "When true, publish the Agent Card gRPC URL from the same base URL used by JSON-RPC/REST, with /grpc appended. Does not change the local gRPC listener port."
}
```

#### 5. 测试：`tests/a2a-gateway.test.ts`

**修改前**

```ts
it("uses configured agentCard.grpcUrl when provided", () => {
  grpcUrl: "domain.com/grpc",
  assert.equal(interfaces[2]?.url, "domain.com/grpc");
});
```

**修改后**

```ts
it("derives published gRPC URL from the same base URL when agentCard.grpcUrl is true", () => {
  grpcUrl: true,
  assert.equal(interfaces[2]?.url, "http://127.0.0.1:18800/grpc");
});
```

### 结果说明

- `agentCard.grpcUrl` 现在是布尔开关，而不是手写字符串
- 当值为 `true` 时，Agent Card 中的 gRPC 地址与 JSON-RPC / REST 一样从基础 URL 派生
- 运行时 gRPC 监听端口逻辑没有变化，仍为 `server.port + 1`

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
