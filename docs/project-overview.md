# Internal Developer Platform - 项目概览

## 项目简介

这是一个基于 Backstage 构建的内部开发者平台（IDP），为 50 人规模的 SaaS 开发公司提供统一的开发者体验。平台集成了 GitHub、Argo CD、AWS EKS、Datadog、Sentry 等工具，提供自助服务能力、标准化工作流、可观测性集成和 AI 辅助开发功能。

## 项目当前状态

### 已完成的工作（Tasks 1-16）

根据 git 历史记录，项目已经完成了核心 MVP 的大部分功能：

1. ✅ **基础设施初始化** - Backstage 应用、PostgreSQL、AWS EKS 配置
2. ✅ **服务目录** - GitHub 集成、自动发现、依赖图可视化
3. ✅ **Golden Path 模板** - Java、Go、React、React Native 项目模板
4. ✅ **Argo CD 集成** - 部署状态可视化、多环境支持
5. ✅ **可观测性插件** - Datadog、Sentry、Prometheus、Grafana、Security Insights、Lighthouse
6. ✅ **CI/CD 工作流插件** - GitHub Actions、PR 管理、构建分析、变更日志
7. ✅ **Kubernetes 和基础设施插件** - 拓扑可视化、Jaeger 追踪、Vault、Nexus、Terraform、GitOps、Kiali、Kubelog
8. ✅ **开发者体验插件** - API 文档、gRPC Playground、TODO 追踪、工具箱、DevTools、依赖图、SDK 生成器、Tech Insights、Tech Radar
9. ✅ **TechDocs 文档系统** - MkDocs、S3 存储、搜索集成
10. ✅ **OpenCost 成本可见性** - Kubernetes 成本、AWS 成本关联、基准测试
11. ✅ **AI 和工程洞察插件** - AI 助手、服务成熟度、DORA 指标、工程效能、事件管理、Kubernetes GPT 分析器
12. ✅ **协作和工作流插件** - Jira、PR 看板、Slack 通知、反馈、成本洞察
13. ✅ **开发环境插件** - DevPod、Dev Containers、Google Calendar
14. ✅ **生产最佳实践** - Docker 多阶段构建、Kubernetes 配置、RBAC、安全加固

**最新提交**: `02c41d3 - fix: start error`
**最新检查点**: `checkpoint-2 - Core platform MVP complete`

### 待完成的工作（Tasks 17-26）

剩余任务主要集中在：

- **Task 17**: 搜索和发现功能
- **Task 18**: n8n 工作流集成插件
- **Task 19**: 认证插件（Keycloak）
- **Task 20**: Feishu 迁移插件
- **Tasks 21-23**: AI 能力增强（Phase 2）
- **Task 24**: 安全和合规插件
- **Tasks 25-26**: 最终集成和测试

## Spec 驱动开发方法论

### 什么是 Spec？

Spec（规格说明）是 Kiro 中用于构建复杂功能的结构化方法。它将开发过程形式化为三个阶段：

1. **Requirements（需求）** - 定义要构建什么
2. **Design（设计）** - 定义如何构建
3. **Tasks（任务）** - 定义实施步骤

### Spec 文件结构

```
.kiro/specs/internal-developer-platform/
├── requirements.md    # 需求文档（使用 EARS 模式）
├── design.md         # 设计文档（包含正确性属性）
└── tasks.md          # 任务列表（可执行的实施计划）
```

### Requirements.md - 需求文档

使用 **EARS（Easy Approach to Requirements Syntax）** 模式编写：

- **Ubiquitous**: THE <system> SHALL <response>
- **Event-driven**: WHEN <trigger>, THE <system> SHALL <response>
- **State-driven**: WHILE <condition>, THE <system> SHALL <response>
- **Unwanted event**: IF <condition>, THEN THE <system> SHALL <response>
- **Optional feature**: WHERE <option>, THE <system> SHALL <response>

**示例**:
```markdown
### Requirement 1: Service Discovery and Catalog Management

**User Story:** As a developer, I want to discover and understand all services...

#### Acceptance Criteria

1. WHEN a developer accesses the Developer_Portal, THE Service_Catalog SHALL display all registered services
2. WHEN a new service is created with catalog-info.yaml, THE Service_Catalog SHALL automatically discover it within 5 minutes
```

### Design.md - 设计文档

包含以下关键部分：

1. **Overview** - 系统概述
2. **Architecture** - 架构设计（包含 Mermaid 图表）
3. **Components and Interfaces** - 组件和接口定义
4. **Data Models** - 数据模型
5. **Correctness Properties** - 正确性属性（用于属性测试）
6. **Error Handling** - 错误处理策略
7. **Testing Strategy** - 测试策略

**正确性属性示例**:
```markdown
Property 1: Service catalog completeness
*For any* set of registered services, the Service_Catalog should display all services with their complete metadata
**Validates: Requirements 1.1**
```

### Tasks.md - 任务列表

可执行的实施计划，包含：

- 主任务和子任务（最多两层）
- 每个任务引用具体的需求
- 可选任务标记为 `*`（如测试任务）
- 检查点任务用于验证进度

**示例**:
```markdown
- [x] 2. Implement Service Catalog with GitHub integration
  - [x] 2.1 Configure GitHub discovery provider
    - _Requirements: 1.2, 1.5_
  - [x]* 2.2 Write property test for service discovery
    - **Property 2: Service discovery automation**
    - **Validates: Requirements 1.2, 1.5**
```

## 如何使用 Spec

### 1. 查看现有 Spec

```bash
# 查看需求
cat .kiro/specs/internal-developer-platform/requirements.md

# 查看设计
cat .kiro/specs/internal-developer-platform/design.md

# 查看任务列表
cat .kiro/specs/internal-developer-platform/tasks.md
```

### 2. 执行任务

在 Kiro IDE 中：
1. 打开 `tasks.md` 文件
2. 找到要执行的任务
3. 点击任务旁边的 "Start task" 按钮
4. Kiro 会根据需求和设计文档自动实施该任务

或者通过命令行告诉 Kiro：
```
请执行 Task 17: 实现搜索和发现功能
```

### 3. 更新 Spec

如果需要修改需求、设计或任务：

```
请更新 requirements.md，添加新的需求...
```

或

```
请更新 design.md，修改架构设计...
```

### 4. 创建新的 Spec

对于新功能：

```
我想创建一个新的功能：[功能描述]
```

Kiro 会引导你完成 Requirements → Design → Tasks 的流程。

## 属性测试（Property-Based Testing）

### 什么是属性测试？

属性测试验证软件在所有有效输入下都满足某些通用属性，而不是测试特定的例子。

**传统单元测试**:
```typescript
test('adding task increases list length', () => {
  const list = ['task1'];
  addTask(list, 'task2');
  expect(list.length).toBe(2);
});
```

**属性测试**:
```typescript
test('Property: adding valid task always increases list length by 1', () => {
  fc.assert(
    fc.property(
      fc.array(fc.string()),  // 随机任务列表
      fc.string({ minLength: 1 }),  // 随机有效任务
      (list, task) => {
        const originalLength = list.length;
        addTask(list, task);
        return list.length === originalLength + 1;
      }
    ),
    { numRuns: 100 }  // 运行 100 次随机测试
  );
});
```

### 项目中的属性测试

本项目定义了 **28 个正确性属性**，涵盖：

- 服务目录完整性
- 项目创建自动化
- 部署状态可见性
- 监控集成
- 文档自动化
- 成本数据准确性
- 工作流集成
- 认证和权限
- 搜索功能
- AI 辅助能力

每个属性都：
1. 在 `design.md` 中定义
2. 在 `tasks.md` 中有对应的测试任务
3. 引用具体的需求条款

## 下一步行动

### 继续开发

1. **完成剩余的核心功能**（Tasks 17-20）
   - 搜索和发现
   - n8n 工作流集成
   - Keycloak 认证
   - Feishu 迁移

2. **实施 AI 增强功能**（Tasks 21-23，Phase 2）
   - AI 助手增强
   - AIOps 智能
   - AI 资源优化

3. **安全和最终集成**（Tasks 24-26）
   - 安全合规插件
   - 端到端测试
   - 性能优化

### 验证和测试

```bash
# 运行所有测试
yarn test:all

# 运行端到端测试
yarn test:e2e

# 验证设置
node scripts/verify-setup.js

# 启动开发服务器
yarn start
```

### 部署

参考 `DEPLOYMENT.md` 了解生产部署到 AWS EKS 的详细步骤。

## 总结

这个项目使用 Spec 驱动开发方法论，确保：

✅ **清晰的需求** - 使用 EARS 模式定义可测试的需求
✅ **完整的设计** - 包含架构、接口、数据模型和正确性属性
✅ **可执行的任务** - 每个任务都引用具体需求，可以逐步实施
✅ **全面的测试** - 结合单元测试和属性测试，确保软件正确性
✅ **渐进式交付** - 分阶段实施，先交付 MVP，再增强 AI 功能

通过这种方法，我们可以系统地构建复杂的平台，同时保持代码质量和可维护性。
