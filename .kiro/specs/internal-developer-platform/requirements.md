# Requirements Document

## Introduction

本文档定义了基于 Backstage 构建的 Internal Developer Platform (IDP) 的需求规格，面向 50 人规模的 SaaS 开发公司。平台已完成 MVP 阶段（Tasks 1-16），现在基于 2026 年 Platform Engineering 最新趋势进行全面重新设计。

本次重新设计遵循"简化优先"原则，移除低 ROI 功能，专注于高价值能力。核心理念：

- **简化优先**：每个功能必须证明其 ROI，默认移除而非添加
- **FinOps 作为一等公民**：成本可见性和优化嵌入到所有工作流程
- **DORA + SPACE 指标**：标准化的平台价值度量
- **服务成熟度驱动**：质量门控和生产就绪检查
- **开发者体验优先**：减少认知负荷，提高 Time-to-Value
- **治理默认**：安全和合规性内置，而非后加
- **社区插件优先**：最大化使用成熟的社区插件，最小化自定义开发

## Glossary

- **IDP**: Internal Developer Platform - 提供开发者自助服务能力的中心化平台
- **Backstage**: Spotify 开源的开发者门户框架
- **Developer_Portal**: 基于 Backstage 的主应用，作为统一的开发者界面
- **Service_Catalog**: 组织内所有服务、API 和组件的注册中心
- **Golden_Path**: 常见开发场景的标准化模板和工作流
- **Platform_Team**: 负责维护和演进 IDP 的团队
- **DORA_Metrics**: DevOps Research and Assessment 指标 - 衡量软件交付性能的行业标准（部署频率、变更前置时间、变更失败率、MTTR）
- **FinOps**: Financial Operations - 云成本管理和优化实践
- **Service_Maturity**: 服务成熟度 - 衡量服务生产就绪程度的综合评分
- **Production_Readiness_Gate**: 生产就绪门控 - 服务部署到生产环境前必须满足的质量标准
- **DevEx**: Developer Experience - 开发者体验，通过可量化指标衡量开发者生产力和满意度
- **NPS**: Net Promoter Score - 开发者满意度评分（-100 到 100）
- **Time_to_Value**: 新工程师从入职到首次生产部署的时间
- **Cost_Attribution**: 成本归因 - 将云成本分配到具体服务、团队和业务单元
- **Governance_by_Default**: 治理默认 - 安全和合规性在基础设施层注入，而非后加

## Requirements

### Requirement 1: Service Discovery and Catalog

**User Story:** 作为开发者，我希望发现和理解生态系统中的所有服务，以便避免重复功能并理解服务依赖关系。

#### Acceptance Criteria

1. WHEN 开发者访问 Developer_Portal 时，THE Service_Catalog SHALL 显示所有已注册服务及其元数据（所有者、仓库链接、部署状态）
2. WHEN 创建包含 catalog-info.yaml 的新服务时，THE Service_Catalog SHALL 在 5 分钟内自动发现并注册该服务
3. WHEN 查看服务时，THE Service_Catalog SHALL 可视化显示服务依赖图和服务成熟度评分
4. WHEN 服务元数据更新时，THE Service_Catalog SHALL 在 5 分钟内反映更新

### Requirement 2: Golden Path Templates

**User Story:** 作为开发者，我希望使用标准化模板创建新服务，以便快速开始开发并遵循公司最佳实践。

#### Acceptance Criteria

1. WHEN 开发者发起项目创建时，THE Developer_Portal SHALL 提供 Golden_Path 模板（Java、Go、React、React Native）
2. WHEN 使用模板创建服务时，THE Developer_Portal SHALL 生成包含完整项目结构的新 GitHub 仓库（Dockerfile、CI/CD 配置、Helm charts、catalog-info.yaml）
3. WHEN 项目创建完成时，THE Developer_Portal SHALL 自动在 Service_Catalog 中注册新服务
4. WHEN 模板生成项目时，THE 生成的项目 SHALL 包含默认的安全扫描、成本预算和合规性检查配置

### Requirement 3: Deployment Status and GitOps

**User Story:** 作为开发者，我希望查看服务的部署状态，以便快速识别和解决部署问题。

#### Acceptance Criteria

1. WHEN 查看服务时，THE Developer_Portal SHALL 显示来自 Argo CD 的当前部署状态（所有环境：development、staging、production）
2. WHEN 部署进行中时，THE Developer_Portal SHALL 显示实时同步状态和健康信息
3. WHEN 部署失败时，THE Developer_Portal SHALL 显示错误消息并链接到详细日志
4. WHEN 开发者拥有服务时，THE Developer_Portal SHALL 允许触发手动同步操作

### Requirement 4: Observability Integration

**User Story:** 作为开发者，我希望访问服务的监控数据和日志，以便在不切换多个工具的情况下排查问题。

#### Acceptance Criteria

1. WHEN 查看服务时，THE Developer_Portal SHALL 嵌入按服务标签过滤的相关 Datadog 仪表板
2. WHEN 发生错误时，THE Developer_Portal SHALL 显示最近的 Sentry 错误及其解决状态
3. WHEN 调查问题时，THE Developer_Portal SHALL 提供直接链接到 Datadog 中的详细日志
4. THE 监控集成 SHALL 遵守来自 Datadog 和 Sentry 的现有 RBAC 权限

### Requirement 5: FinOps and Cost Optimization

**User Story:** 作为开发者，我希望理解服务的成本影响并获得可操作的洞察，以便做出符合业务目标的资源使用和优化决策。

#### Acceptance Criteria

1. WHEN 查看服务时，THE Developer_Portal SHALL 显示来自 OpenCost 的月度 Kubernetes 成本（CPU、内存、存储细分）和 AWS 资源成本
2. WHEN 成本趋势显著变化时，THE Developer_Portal SHALL 突出显示成本增减及百分比变化
3. WHEN 部署前时，THE Developer_Portal SHALL 验证预估成本并在超出预算时阻止部署（需要审批）
4. WHEN 检测到成本异常时，THE Developer_Portal SHALL 向服务所有者发送告警并提供推荐操作
5. WHEN 查看成本数据时，THE Developer_Portal SHALL 显示成本效率指标（每请求成本、每用户成本）并与业务 KPI 对齐

### Requirement 6: DORA Metrics and DevEx Analytics

**User Story:** 作为平台管理员，我希望通过可量化指标衡量和改进开发者体验，以便证明平台价值并指导持续改进。

#### Acceptance Criteria

1. WHEN 衡量开发者生产力时，THE Developer_Portal SHALL 跟踪每个团队和服务的 DORA_Metrics（部署频率、变更前置时间、变更失败率、MTTR）
2. WHEN 分析平台采用情况时，THE Developer_Portal SHALL 显示日活跃用户、服务创建率和功能使用模式
3. WHEN 评估开发者满意度时，THE Developer_Portal SHALL 收集并显示 NPS 评分和反馈趋势
4. WHEN 识别瓶颈时，THE Developer_Portal SHALL 突出显示慢速工作流和高摩擦区域并量化影响
5. THE 分析系统 SHALL 遵守隐私要求并适当聚合数据

### Requirement 7: Service Maturity and Production Readiness

**User Story:** 作为平台管理员，我希望跟踪服务成熟度和生产就绪状态，以便确保服务在生产部署前满足质量标准。

#### Acceptance Criteria

1. WHEN 评估服务时，THE Developer_Portal SHALL 显示覆盖文档、测试、监控、安全和成本效率的成熟度评分卡
2. WHEN 服务未通过成熟度检查时，THE Developer_Portal SHALL 提供可操作的改进建议
3. WHEN 部署到生产环境时，THE Developer_Portal SHALL 强制执行最低成熟度要求（Production_Readiness_Gate）
4. WHEN 比较服务时，THE Developer_Portal SHALL 显示跨团队的成熟度基准
5. THE 成熟度系统 SHALL 跟踪随时间的改进趋势并庆祝进展

### Requirement 8: Developer Self-Service with Governance

**User Story:** 作为开发者，我希望在安全边界内自主完成常见操作，以便快速行动而不违反安全和合规性要求。

#### Acceptance Criteria

1. WHEN 用户访问 Developer_Portal 时，THE 系统 SHALL 通过 GitHub OAuth 或 Keycloak OIDC 进行身份验证
2. WHEN 用户角色变更时，THE Developer_Portal SHALL 在 5 分钟内反映更新的权限
3. WHEN 执行搜索时，THE Developer_Portal SHALL 返回来自服务、文档、API 和团队信息的结果，并按相关性和最近活动排序
4. WHEN 查看敏感信息时，THE Developer_Portal SHALL 强制执行基于角色的访问控制
5. WHEN 创建新服务时，THE Golden_Path 模板 SHALL 包含默认的安全扫描、合规性检查和策略验证

## Removed Requirements (Low ROI)

以下需求已从原始规格中移除，原因是低 ROI 或复杂度过高：

### 原 Requirement 5: Documentation as Code
**移除原因**: TechDocs 已在 MVP 中实现（Task 10），功能完整且稳定。不需要单独的需求，文档系统已作为平台核心功能运行。

### 原 Requirement 7: n8n Workflow Automation
**移除原因**: 复杂集成，采用率有限。审批工作流可以通过现有的 GitHub/Jira 集成处理。n8n 增加了另一层复杂性，而大多数工作流需求可以通过 Backstage Scaffolder Actions 和 GitHub Actions 满足。

### 原 Requirement 9: Identity and Access Management (单独需求)
**移除原因**: 合并到 Requirement 8（Developer Self-Service with Governance）。IAM 不是独立功能，而是治理和自助服务的基础。

### 原 Requirement 10: Search and Discovery (单独需求)
**移除原因**: 合并到 Requirement 8（Developer Self-Service with Governance）。搜索是自助服务的核心组成部分，不需要单独需求。

### 原 Requirement 11: AI-Assisted Development (自定义 AI 代码生成)
**移除原因**: 开发者已经使用 GitHub Copilot 和 Cursor。平台级代码生成增加复杂性而没有明确差异化。保留简化的 AI 辅助故障排除（使用社区插件 @veecode/backstage-plugin-kubernetes-gpt-analyzer 和 @roadie/backstage-plugin-ai-assistant），但移除自定义 AI 代码生成。

### 原 Requirement 12: AIOps with Custom ML Models
**移除原因**: 过于复杂。自定义 ML 模型用于异常检测和资源优化的 ROI 不明确。OpenCost + 基本告警提供 80% 的价值，只需 20% 的努力。替换为更简单的 AI 辅助故障排除（使用现有社区插件）。

### 原 Requirement 13: AI Resource Optimization with Custom ML
**移除原因**: 与 Requirement 12 类似，自定义 ML 资源优化过于复杂。OpenCost 已提供成本可见性，基本的成本异常检测（基于阈值）提供足够价值。自定义 ML 优化需要大量数据科学投入，ROI 不明确。

### 原 Requirement 5.5: Feishu Document Migration
**移除原因**: 一次性迁移任务，不是平台功能。可以作为单独项目处理，不应该是 IDP 核心需求的一部分。

## Enhanced Requirements for 2026

以下需求与 2026 年新兴的 Platform Engineering 最佳实践对齐：

### Requirement 5: FinOps and Cost Optimization (增强)
- **新增**: 预部署成本验证和预算门控（AC 3）
- **新增**: 成本异常检测与可操作告警（AC 4）
- **新增**: 成本效率指标与业务 KPI 对齐（AC 5）
- **理由**: FinOps 是 2026 年平台工程的核心趋势。成本信息必须嵌入到现有工具中，预部署成本验证防止昂贵部署发生。

### Requirement 6: DORA Metrics and DevEx Analytics (新增)
- **新增**: DORA 指标跟踪（AC 1）- 40.8% 的团队采用 DORA 作为核心指标框架
- **新增**: 平台采用率分析（AC 2）
- **新增**: 开发者满意度 NPS 跟踪（AC 3）
- **新增**: 瓶颈识别与量化影响（AC 4）
- **理由**: 证明平台 ROI 和价值的标准化方法。DORA 指标是行业标准，DevEx 指标帮助识别摩擦点。

### Requirement 7: Service Maturity and Production Readiness (新增)
- **新增**: 服务成熟度评分卡（AC 1）
- **新增**: 可操作的改进建议（AC 2）
- **新增**: 生产就绪门控（AC 3）
- **新增**: 跨团队成熟度基准（AC 4）
- **新增**: 改进趋势跟踪（AC 5）
- **理由**: 使用 Scorecards 强制执行 DevOps、安全和服务最佳实践是 2026 年核心趋势。生产就绪门控确保质量。

### Requirement 8: Developer Self-Service with Governance (简化合并)
- **合并**: 原 Requirement 7（IAM）、Requirement 9（Search）和部分 Requirement 11（Shift-Left Security）
- **新增**: 治理默认（Governance-by-default）- AC 5
- **理由**: 自助服务与治理平衡是 2026 年核心原则。在安全边界内实现开发者自主，治理内置而非后加。

## Requirements Prioritization

**High Priority (Must Have):**
- Requirements 1-4: 核心平台功能（已在 MVP 中实现）
- Requirement 5: FinOps and Cost Optimization（高业务价值，2026 年核心趋势）
- Requirement 6: DORA Metrics and DevEx Analytics（证明平台 ROI）
- Requirement 7: Service Maturity and Production Readiness（质量门控，2026 年核心趋势）

**Medium Priority (Should Have):**
- Requirement 8: Developer Self-Service with Governance（质量改进，已在 MVP 中部分实现）

**Low Priority (Nice to Have):**
- AI 辅助故障排除（实验性，使用社区插件，低复杂度）

## Success Metrics

基于 2026 年 Platform Engineering 最佳实践的成功指标：

### 开发者体验指标
- **Time-to-Value**: 新工程师从入职到首次生产部署 < 4 小时（目标从当前 6 小时改进）
- **Developer NPS**: 开发者满意度评分 > 8.0（-100 到 100 量表）
- **Platform Adoption Rate**: 平台自助服务完成率 > 95%（无需提交工单）

### DORA 指标（行业标准）
- **Deployment Frequency**: 每天多次部署（Elite 级别）
- **Lead Time for Changes**: < 1 天（Elite 级别）
- **Change Failure Rate**: < 15%（Elite 级别）
- **Time to Restore Service (MTTR)**: < 1 小时（Elite 级别）
- **DORA Metrics Improvement**: 12 个月内部署频率和前置时间改进 20%

### FinOps 指标
- **Cost Visibility Adoption**: 100% 服务有成本归因和优化建议
- **Cost Anomaly Detection**: 90% 成本异常在 24 小时内检测并告警
- **Budget Compliance**: 95% 服务保持在月度预算内
- **Cost Efficiency Improvement**: 12 个月内每请求成本降低 15%

### 服务质量指标
- **Service Maturity Score**: 80% 生产服务成熟度评分 > 70
- **Production Readiness**: 100% 生产部署通过所有必需的 Production_Readiness_Gate
- **Security Vulnerability MTTR**: 高严重性漏洞 < 7 天修复
- **Documentation Coverage**: 95% 服务有最新的 TechDocs

### 平台运营指标
- **Platform Uptime**: > 99.9%
- **Daily Active Users**: > 90% 工程师每周至少使用一次
- **Service Creation Time**: 保持 < 6 小时（已在 MVP 中实现）
- **Feature Usage**: 核心功能（Service Catalog、Golden Paths、Deployment Status、Observability）使用率 > 90%

## Implementation Notes

### 社区插件优先策略

本规格最大化使用成熟的 Backstage 社区插件，减少自定义开发：

**已安装的社区插件（MVP 阶段，Tasks 1-16）:**
- @roadie/backstage-plugin-datadog（监控集成）
- @spotify/backstage-plugin-sentry（错误跟踪）
- @mattray/backstage-plugin-opencost（成本可见性）
- @roadie/backstage-plugin-ai-assistant（AI 辅助）
- @veecode/backstage-plugin-kubernetes-gpt-analyzer（AI 故障排除）
- @devoteam/backstage-plugin-opendora（DORA 指标）
- @backstage-community/plugin-tech-insights（服务评分卡）
- 以及 30+ 其他社区插件（详见 tasks.md）

**自定义开发仅限于:**
1. FinOps 预部署成本门控（Requirement 5, AC 3）
2. 成本异常检测与告警（Requirement 5, AC 4）
3. 服务成熟度评分卡自定义规则（Requirement 7）
4. 开发者 NPS 收集与分析（Requirement 6, AC 3）
5. 业务价值 ROI 跟踪（Requirement 6）

### 简化优先原则

每个功能必须通过以下测试：
1. **ROI 测试**: 功能提供的价值是否明显超过实现和维护成本？
2. **采用率测试**: 是否有 > 50% 的开发者会使用此功能？
3. **复杂度测试**: 是否可以用更简单的方法实现 80% 的价值？
4. **社区插件测试**: 是否有成熟的社区插件可以满足需求？

**未通过测试的功能已移除**（见 Removed Requirements 部分）。

### 2026 年核心趋势对齐

本规格与以下 2026 年 Platform Engineering 核心趋势对齐：

1. **简化优先**: 从 12 个需求精简到 8 个，移除低 ROI 功能
2. **FinOps 深度集成**: 成本信息嵌入到所有工作流程，预部署成本验证
3. **DORA 指标标准化**: 使用行业标准衡量平台价值
4. **开发者体验优先**: Time-to-Value 和 NPS 作为核心指标
5. **服务成熟度和质量门控**: 生产就绪检查和自动化质量跟踪
6. **AI 时代的平台工程**: 简化的 AI 辅助故障排除，避免过度复杂的自定义 ML
7. **自助服务与治理平衡**: 治理默认，安全边界内的开发者自主
