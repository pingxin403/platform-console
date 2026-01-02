# Implementation Plan: Internal Developer Platform

## Overview

This implementation plan breaks down the Internal Developer Platform (IDP) development into discrete, manageable tasks using TypeScript. The approach follows a phased delivery strategy, prioritizing core platform functionality (MVP) before advanced AI features. Each task builds incrementally on previous work to ensure continuous validation and early value delivery.

**Implementation follows official Backstage best practices:**
- **Multi-stage Docker builds** with minimal hardened images (wolfi-base)
- **Production-ready Kubernetes** configurations with proper resource limits
- **Optimized catalog processing** with deferred stitching and error handling
- **Secure authentication** with proper token signing and RBAC
- **Database optimization** with connection pooling and performance tuning

**Key Changes from Original Plan:**
- **Leverages 40+ existing community plugins** to reduce development time by ~80%
- **Includes 2025's top-rated Backstage plugins** for maximum effectiveness
- **Adds comprehensive service maturity and incident management** capabilities
- **Focuses custom development** on unique integrations (n8n, Feishu, specialized AI enhancements)
- **Maintains same 28 correctness properties** for comprehensive testing coverage
- **Applies Backstage production best practices** and security hardening
- **Total of 27 tasks** organized in two phases: MVP (Tasks 1-20) and AI enhancements (Tasks 21-27)

## Tasks

- [x] 1. Initialize Backstage application and core infrastructure
  - Create new Backstage app using official TypeScript template
  - Configure PostgreSQL database connection and entity providers
  - Set up AWS EKS deployment configuration with Helm charts
  - Configure GitHub OAuth authentication
  - **Apply Backstage best practices**: Enable RBAC, configure proper logging, set up health checks
  - **Setup Docker configuration**: Create multi-stage Dockerfile with security best practices
  - **Configure Kubernetes manifests**: Set up proper namespaces, secrets, and persistent volumes
  - **Commit changes**: `git add . && git commit -m "feat: initialize Backstage application and core infrastructure"`
  - _Requirements: 8.1_

- [x] 2. Implement Service Catalog with GitHub integration
  - [x] 2.1 Configure GitHub discovery provider for catalog-info.yaml files
    - Set up GitHub API integration with organization access
    - Implement automated repository scanning and entity registration
    - _Requirements: 1.2, 1.5_

  - [x] 2.2 Write property test for service discovery automation
    - **Property 2: Service discovery automation**
    - **Validates: Requirements 1.2, 1.5**

  - [x] 2.3 Implement service catalog display with metadata
    - Create service overview components showing owner, repository, and dependencies
    - Implement dependency graph visualization using React components
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 2.4 Write property test for service catalog completeness
    - **Property 1: Service catalog completeness**
    - **Validates: Requirements 1.1**

  - [x] 2.5 Write property test for service information display
    - **Property 3: Service information display**
    - **Validates: Requirements 1.3, 1.4**

- [x] 3. Develop Golden Path templates and scaffolder
  - [x] 3.1 Create project templates for Java, Go, React, and React Native
    - Implement Scaffolder templates with complete project structure
    - Include Dockerfile, GitHub Actions workflows, Helm charts, and catalog-info.yaml
    - Configure integration points for Argo CD, Datadog, and Sentry
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.2 Write property test for template availability
    - **Property 4: Template availability**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 3.3 Write property test for generated project completeness
    - **Property 5: Generated project completeness**
    - **Validates: Requirements 2.3, 2.5**

  - [x] 3.4 Implement automatic service registration after project creation
    - Create custom Scaffolder actions for GitHub repository creation
    - Implement automatic catalog registration workflow
    - _Requirements: 2.4_

  - [x] 3.5 Write property test for project registration automation
    - **Property 6: Project registration automation**
    - **Validates: Requirements 2.4**

- [x] 4. Checkpoint - Ensure core catalog and scaffolder functionality works
  - Ensure all tests pass, ask the user if questions arise.
  - **Checkpoint commit**: `git add . && git commit -m "checkpoint: core catalog and scaffolder functionality complete" && git tag -a "checkpoint-1" -m "Checkpoint 1: Core catalog and scaffolder" && git push origin main --tags`

- [x] 5. Integrate Argo CD for deployment status
  - [x] 5.1 Implement Argo CD plugin integration
    - Configure Argo CD API connection with service account authentication
    - Create service-to-application mapping via catalog annotations
    - Implement real-time deployment status display
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Write property test for deployment status visibility
    - **Property 7: Deployment status visibility**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 5.3 Add deployment error handling and manual sync capabilities
    - Implement error message display with log links
    - Add manual sync operation buttons for service owners
    - Support multi-environment status display
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 5.4 Write property test for multi-environment support
    - **Property 8: Multi-environment support**
    - **Validates: Requirements 3.4, 3.5**

- [x] 6. Install and configure observability and monitoring plugins (existing community plugins)
  - [x] 6.1 Install @roadie/backstage-plugin-datadog for dashboard embedding
    - Install the community Datadog plugin from Roadie
    - Configure secure iframe embedding for service-specific dashboards
    - Set up dashboard filtering by service tags and direct links to logs
    - **Commit**: `git add . && git commit -m "feat: integrate Datadog plugin for dashboard embedding"`
    - _Requirements: 4.1, 4.3_

  - [x] 6.2 Install @spotify/backstage-plugin-sentry for error tracking
    - Install the community Sentry plugin from Spotify
    - Configure recent error display with resolution status
    - Set up alert status and escalation information display
    - Ensure RBAC permissions are respected from external systems
    - _Requirements: 4.2, 4.4, 4.5_

  - [x] 6.3 Install @roadie/backstage-plugin-prometheus for metrics
    - Install Prometheus plugin for additional metrics and alerting
    - Configure service-level metrics display and alert integration
    - Set up custom metrics queries for service health monitoring
    - _Requirements: 4.1, 4.4_

  - [x] 6.4 Install @k-phoen/backstage-plugin-grafana for dashboards
    - Install Grafana plugin for additional dashboard embedding
    - Configure Grafana dashboard and alert integration
    - Set up multi-dashboard support for different service types
    - _Requirements: 4.1, 4.3_

  - [x] 6.5 Install @roadie/backstage-plugin-security-insights for vulnerability management
    - Install Security Insights plugin for GitHub vulnerabilities and Dependabot alerts
    - Configure vulnerability filtering, search, and overview widgets
    - Set up integration with existing security scanning workflows
    - _Requirements: 4.2, 4.4_

  - [x] 6.6 Install @spotify/backstage-plugin-lighthouse for performance monitoring
    - Install Lighthouse plugin for on-demand performance audits
    - Configure accessibility, performance, SEO, and best-practices tracking
    - Set up integration with lighthouse-audit-service
    - _Requirements: 4.1, 4.3_

  - [ ]* 6.7 Write property test for monitoring integration completeness
    - **Property 9: Monitoring integration completeness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ]* 6.8 Write property test for RBAC enforcement
    - **Property 10: RBAC enforcement**
    - **Validates: Requirements 4.5**

- [ ] 7. Install CI/CD and development workflow plugins (existing community plugins)
  - [ ] 7.1 Install @spotify/backstage-plugin-github-actions for CI/CD visibility
    - Install GitHub Actions plugin for pipeline status and history
    - Configure workflow run display and re-trigger capabilities
    - Set up build status integration with service catalog
    - _Requirements: 3.1, 3.2_

  - [ ] 7.2 Install @roadie/backstage-plugin-github-pull-requests for PR management
    - Install GitHub Pull Requests plugin for PR visibility
    - Configure PR status display and team collaboration features
    - Set up PR metrics and review workflow integration
    - _Requirements: 9.1, 9.2_

  - [ ] 7.3 Install @spotify/backstage-plugin-ci-cd-statistics for build analytics
    - Install CI/CD Statistics plugin for build performance tracking
    - Configure build duration and success rate metrics
    - Set up trend analysis and performance benchmarking
    - _Requirements: 13.1, 13.2_

  - [ ] 7.4 Install @roadie/backstage-plugin-scaffolder-git-actions for enhanced scaffolding
    - Install Git Actions for Scaffolder to enhance template capabilities
    - Configure advanced git operations in templates
    - Set up automated repository setup and configuration
    - _Requirements: 2.1, 2.2_

  - [ ] 7.5 Install changelog viewer plugin for release tracking
    - Install community changelog plugin for version and release tracking
    - Configure automatic changelog generation from git commits and PRs
    - Set up release notes and version history visualization
    - _Requirements: 3.1, 3.2, 13.1_

  - [ ] 7.6 Install Jenkins plugin for CI/CD integration (if using Jenkins)
    - Install community Jenkins plugin for build pipeline visibility
    - Configure Jenkins job status and build history display
    - Set up integration with existing Jenkins infrastructure
    - _Requirements: 3.1, 3.2_

  - [ ] 7.7 Install GitHub Insights plugin for repository analytics
    - Install community GitHub Insights plugin for code and team metrics
    - Configure repository activity, contributor insights, and code quality metrics
    - Set up team productivity and collaboration analytics
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 7.8 Write integration tests for CI/CD workflow visibility
    - Test GitHub Actions integration and build status display
    - Verify PR workflow, statistics collection, and changelog generation
    - Test Jenkins integration and GitHub insights functionality
    - _Requirements: 3.1, 3.2, 13.1_

- [ ] 8. Install Kubernetes and infrastructure plugins (existing community plugins)
  - [ ] 8.1 Install @red-hat/backstage-plugin-topology for Kubernetes visualization
    - Install Application Topology plugin for Kubernetes workload visualization
    - Configure deployment, pod, and service topology views
    - Set up real-time status monitoring and resource inspection
    - _Requirements: 3.1, 3.4_

  - [ ] 8.2 Install @deepankumar/backstage-plugin-jaeger for distributed tracing
    - Install Jaeger Tracing plugin for request tracing and performance analysis
    - Configure trace visualization and service dependency mapping
    - Set up performance bottleneck identification and analysis
    - _Requirements: 4.1, 4.3_

  - [ ] 8.3 Install @spreadgroup/backstage-plugin-vault for secrets management
    - Install Vault plugin for secrets visibility and management
    - Configure secret access and rotation status display
    - Set up integration with AWS Secrets Manager workflow
    - _Requirements: 8.4_

  - [ ] 8.4 Install @red-hat/backstage-plugin-nexus for artifact management
    - Install Nexus Repository Manager plugin for build artifact visibility
    - Configure artifact version tracking and dependency management
    - Set up integration with existing Nexus instance
    - _Requirements: 2.3, 2.5_

  - [ ] 8.5 Install Terraform provider plugin for infrastructure management
    - Install community Terraform plugin for infrastructure as code visibility
    - Configure Terraform state and plan visualization
    - Set up integration with AWS EKS and infrastructure workflows
    - _Requirements: 3.1, 3.4, 8.4_

  - [ ] 8.6 Install GitOps clusters plugin for multi-cluster management
    - Install community GitOps clusters plugin for Argo CD cluster visibility
    - Configure multi-cluster deployment status and health monitoring
    - Set up cluster resource utilization and capacity planning
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ] 8.7 Install Kiali service mesh plugin for microservices observability
    - Install Kiali plugin for Istio service mesh visualization
    - Configure service topology and traffic flow monitoring
    - Set up distributed tracing and performance analysis
    - _Requirements: 4.1, 4.3_

  - [ ] 8.8 Install Kubelog plugin for Kubernetes log viewing
    - Install community Kubelog plugin for centralized log access
    - Configure pod and container log streaming and search
    - Set up log filtering and real-time monitoring capabilities
    - _Requirements: 4.1, 4.3_

  - [ ]* 8.9 Write integration tests for Kubernetes and infrastructure plugins
    - Test topology visualization and resource monitoring
    - Verify tracing integration, secrets management, and Terraform integration
    - Test GitOps clusters, service mesh, and logging functionality
    - _Requirements: 3.1, 4.1, 8.4_

- [ ] 9. Install developer experience and productivity plugins (existing community plugins)
  - [ ] 9.1 Install @sda-se/backstage-plugin-api-docs for API documentation
    - Install API Docs plugin for OpenAPI, AsyncAPI, and GraphQL documentation
    - Configure automatic API documentation generation and display
    - Set up API testing and exploration capabilities
    - _Requirements: 5.1, 5.3_

  - [ ] 9.2 Install @zalopay-oss/backstage-plugin-grpc-playground for gRPC testing
    - Install gRPC Playground for service testing and exploration
    - Configure gRPC service discovery and testing capabilities
    - Set up protocol buffer documentation and testing
    - _Requirements: 5.3, 9.1_

  - [ ] 9.3 Install @spotify/backstage-plugin-todo for code quality tracking
    - Install TODO plugin for tracking code comments and technical debt
    - Configure TODO/FIXME comment aggregation and reporting
    - Set up code quality metrics and improvement tracking
    - _Requirements: 13.1, 13.3_

  - [ ] 9.4 Install @drodil/backstage-plugin-toolbox for developer utilities
    - Install Toolbox plugin for developer utility tools
    - Configure converters, validators, and common development tools
    - Set up JWT decoding, QR code generation, and other utilities
    - _Requirements: 9.1_

  - [ ] 9.5 Install @keyloop/backstage-plugin-devtools for diagnostics
    - Install DevTools plugin for Backstage runtime diagnostics
    - Configure system health monitoring and configuration visibility
    - Set up dependency checking and troubleshooting tools
    - _Requirements: 13.2_

  - [ ] 9.6 Install catalog graph plugin for service dependency visualization
    - Install community catalog graph plugin for dependency mapping
    - Configure interactive service dependency visualization
    - Set up real-time dependency tracking and impact analysis
    - _Requirements: 1.3, 1.4_

  - [ ] 9.7 Install API SDK generator plugin for automated SDK generation
    - Install community API SDK generator for Java, Go, and TypeScript
    - Configure automatic SDK generation from OpenAPI specifications
    - Set up SDK publishing and distribution workflows
    - _Requirements: 2.3, 5.1, 5.3_

  - [ ] 9.8 Install @roadie/backstage-plugin-tech-insights for quality scorecards
    - Install Tech Insights plugin for entity quality measurement
    - Configure compliance scorecards and operational health metrics
    - Set up automated quality checks and improvement tracking
    - _Requirements: 13.1, 13.3, 13.4_

  - [ ] 9.9 Install @spotify/backstage-plugin-tech-radar for technology tracking
    - Install Tech Radar plugin for technology adoption visualization
    - Configure quadrants, rings, and entry timelines for tech stack
    - Set up team technology decision tracking and communication
    - _Requirements: 13.1, 13.3_

  - [ ]* 9.10 Write integration tests for developer experience plugins
    - Test API documentation generation and gRPC playground functionality
    - Verify TODO tracking, developer toolbox utilities, and catalog graph
    - Test SDK generation, tech insights, and tech radar functionality
    - _Requirements: 1.3, 5.1, 5.3, 9.1, 13.1_

- [ ] 10. Implement TechDocs documentation system
  - [ ] 10.1 Configure TechDocs with MkDocs and S3 storage
    - Set up automatic documentation generation from /docs directories
    - Configure S3 bucket for static asset storage
    - Implement documentation rebuild triggers and timing
    - _Requirements: 5.1, 5.2_

  - [ ] 10.2 Add Markdown feature support and search integration
    - Ensure support for diagrams, code snippets, and cross-references
    - Integrate with Backstage search for documentation indexing
    - _Requirements: 5.3, 5.4_

  - [ ]* 10.3 Write property test for documentation automation
    - **Property 11: Documentation automation**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 10.4 Write property test for documentation search
    - **Property 12: Documentation search and migration**
    - **Validates: Requirements 5.4, 5.5**

- [ ] 11. Install OpenCost plugin and configure cost visibility (existing community plugin)
  - [ ] 11.1 Install @mattray/backstage-plugin-opencost for cost visibility
    - Install the community OpenCost plugin by Matt Ray
    - Configure OpenCost API integration for Kubernetes cost data
    - Set up cost display components with monthly breakdowns
    - Add cost trend analysis and highlighting for significant changes
    - _Requirements: 6.1, 6.2_

  - [ ] 11.2 Enhance with AWS cost correlation and benchmarking
    - Implement AWS cost data integration via cost allocation tags
    - Create cost benchmarking functionality for similar services
    - Ensure daily cost data updates with complete breakdowns
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 11.3 Write property test for cost data display
    - **Property 13: Cost data display**
    - **Validates: Requirements 6.1, 6.2, 6.4**

  - [ ]* 11.4 Write property test for cost benchmarking and freshness
    - **Property 14: Cost benchmarking and freshness**
    - **Validates: Requirements 6.3, 6.5**

- [ ] 12. Install AI and engineering insights plugins (existing community plugins)
  - [ ] 12.1 Install @roadie/backstage-plugin-ai-assistant for AI-powered assistance
    - Install AI Assistant plugin with RAG capabilities for internal documentation
    - Configure AI-powered search and answers over internal docs and code
    - Set up context-aware AI assistance for development tasks
    - _Requirements: 10.1, 10.2_

  - [ ] 12.2 Install @opslevel/backstage-plugin-service-maturity for service quality management
    - Install OpsLevel Service Maturity plugin for comprehensive service health tracking
    - Configure service maturity rubrics and automated quality checks
    - Set up production readiness dashboards and improvement tracking
    - _Requirements: 13.1, 13.3, 13.4_

  - [ ] 12.3 Install @devoteam/backstage-plugin-opendora for DORA metrics
    - Install OpenDORA plugin for comprehensive DORA metrics tracking
    - Configure deployment frequency, lead time, and change failure rate tracking
    - Set up team and service-level DORA dashboards and benchmarking
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 12.4 Install @cortex/backstage-plugin-dx for engineering effectiveness
    - Install DX plugin for engineering effectiveness scorecards and insights
    - Configure developer experience metrics and team performance tracking
    - Set up custom scorecards for service quality and operational excellence
    - _Requirements: 13.1, 13.3, 13.4_

  - [ ] 12.5 Install @firehydrant/backstage-plugin-firehydrant for incident management
    - Install FireHydrant plugin for real-time incident visibility and management
    - Configure service-specific incident tracking and reliability metrics
    - Set up incident response workflows and post-mortem integration
    - _Requirements: 4.2, 11.1, 11.2_

  - [ ] 12.6 Install @veecode/backstage-plugin-kubernetes-gpt-analyzer for AI troubleshooting
    - Install Kubernetes GPT Analyzer for AI-powered error analysis
    - Configure automatic Kubernetes issue detection and root cause analysis
    - Set up AI-generated troubleshooting suggestions and remediation steps
    - _Requirements: 10.3, 11.1, 11.2_

  - [ ]* 12.7 Write integration tests for AI and insights plugins
    - Test AI assistant functionality and DORA metrics collection
    - Verify engineering effectiveness tracking and Kubernetes AI analysis
    - Test service maturity tracking and incident management integration
    - _Requirements: 10.1, 10.3, 13.1_

- [ ] 13. Install collaboration and workflow plugins (existing community plugins)
  - [ ] 13.1 Install @roadie/backstage-plugin-jira for issue tracking integration
    - Install Jira plugin for issue and project tracking visibility
    - Configure issue display and project progress tracking on entity pages
    - Set up team workload visibility and sprint planning integration
    - _Requirements: 7.1, 9.1_

  - [ ] 13.2 Install @dazn/backstage-plugin-github-pull-requests-board for PR management
    - Install GitHub Pull Requests Board for team PR visibility
    - Configure team-wide PR tracking and review workflow optimization
    - Set up PR metrics and team collaboration insights
    - _Requirements: 9.1, 13.1_

  - [ ] 13.3 Install @drew-hill/backstage-plugin-slack-scaffolder-actions for notifications
    - Install Slack Scaffolder Actions for workflow notifications
    - Configure automated Slack notifications for deployments and incidents
    - Set up team communication integration with platform events
    - _Requirements: 7.4, 13.2_

  - [ ] 13.4 Install @red-hat/backstage-plugin-feedback for user feedback
    - Install Feedback plugin for collecting user experience feedback
    - Configure service and platform feedback collection and analysis
    - Set up feedback-driven improvement tracking and prioritization
    - _Requirements: 13.4, 13.5_

  - [ ] 13.5 Install Jira Dashboard plugin for enhanced project visibility
    - Install community Jira Dashboard plugin for advanced project tracking
    - Configure sprint dashboards, burndown charts, and team velocity metrics
    - Set up integration with existing Jira workflows and reporting
    - _Requirements: 7.1, 9.1, 13.1_

  - [ ] 13.6 Install Shortcut plugin for agile project management (alternative to Jira)
    - Install community Shortcut plugin for story and epic tracking
    - Configure team workflow visibility and project progress tracking
    - Set up integration with development workflows and releases
    - _Requirements: 7.1, 9.1_

  - [ ] 13.7 Install @roadie/backstage-plugin-buildkite for CI/CD integration (if using Buildkite)
    - Install Buildkite plugin for build pipeline visibility and control
    - Configure build status display, retriggering, and real-time step inspection
    - Set up integration with existing Buildkite infrastructure
    - _Requirements: 3.1, 3.2_

  - [ ] 13.8 Install @spotify/backstage-plugin-cost-insights for cloud cost management
    - Install Cost Insights plugin for daily cost trends and optimization
    - Configure cost tracking by team and catalog entity
    - Set up business metrics comparison and actionable cost alerts
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 13.9 Write integration tests for collaboration plugins
    - Test Jira integration and PR board functionality
    - Verify Slack notifications and feedback collection
    - Test enhanced Jira dashboards, Shortcut, and cost insights
    - _Requirements: 6.1, 7.1, 7.4, 9.1_

- [ ] 14. Install additional development and infrastructure plugins
  - [ ] 14.1 Install @coder/backstage-plugin-devpod for development environments
    - Install DevPod plugin for containerized development environment management
    - Configure development environment provisioning and access
    - Set up integration with existing development workflows
    - _Requirements: 2.1, 2.2_

  - [ ] 14.2 Install @coder/backstage-plugin-dev-containers for VS Code integration
    - Install Dev Containers plugin for VS Code development environment integration
    - Configure containerized development environment launching
    - Set up development environment standardization and sharing
    - _Requirements: 2.1, 2.2_

  - [ ] 14.3 Install @spotify/backstage-plugin-google-calendar for team coordination
    - Install Google Calendar plugin for team schedule and availability visibility
    - Configure meeting and availability integration on team pages
    - Set up calendar-based team coordination and planning features
    - _Requirements: 13.3_

  - [ ]* 14.4 Write integration tests for development environment plugins
    - Test DevPod and Dev Containers functionality
    - Verify calendar integration and team coordination features
    - _Requirements: 2.1, 13.3_

- [ ] 15. Apply Backstage production best practices and security hardening
  - Configure production-ready database settings and connection pooling
  - Set up proper logging, monitoring, and health check endpoints
  - Implement RBAC (Role-Based Access Control) for sensitive operations
  - Configure CSP (Content Security Policy) and security headers
  - Set up backup and disaster recovery procedures
  - **Apply Docker best practices**: Use multi-stage builds, minimal hardened images (wolfi-base)
  - **Configure Kubernetes deployment**: Set up proper resource limits, health checks, and persistent volumes
  - **Set up authentication**: Configure proper token issuers and signing keys for production
  - **Configure catalog processing**: Set optimal processing intervals and stitching strategies
  - **Enable catalog error handling**: Set up event-based error monitoring and alerting
  - **Commit**: `git add . && git commit -m "config: apply production best practices and security hardening"`
  - _Requirements: 8.1, 8.3, 8.4, 8.5_

- [ ] 16. Checkpoint - Core platform MVP complete
  - Ensure all tests pass, ask the user if questions arise.
  - **Checkpoint commit**: `git add . && git commit -m "checkpoint: core platform MVP complete" && git tag -a "checkpoint-2" -m "Checkpoint 2: Core platform MVP" && git push origin main --tags`

- [ ] 17. Implement search and discovery functionality
  - [ ] 17.1 Configure Backstage search with PostgreSQL backend
    - Set up search indexing for services, documentation, APIs, and team information
    - Implement result ranking by relevance and recent activity
    - Add category filtering and suggestion capabilities
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 17.2 Add real-time search index updates
    - Implement webhook-based index updates for all integrated tools
    - Ensure search results reflect changes in real-time
    - _Requirements: 9.5_

  - [ ]* 17.3 Write property test for search comprehensiveness
    - **Property 19: Search comprehensiveness**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [ ]* 17.4 Write property test for search index management
    - **Property 20: Search index management**
    - **Validates: Requirements 9.5**

- [ ] 18. Develop n8n workflow integration plugin
  - [ ] 18.1 Create @internal/plugin-n8n-actions for workflow automation
    - Implement n8n API integration for workflow triggering
    - Create workflow status tracking and progress notifications
    - Add self-service action buttons for common operational scenarios
    - _Requirements: 7.1, 7.3, 7.4_

  - [ ] 18.2 Implement permission automation workflows
    - Create workflows for production access requests and approvals
    - Implement automatic permission updates in Keycloak and Argo CD
    - Add support for custom Platform_Team defined actions
    - _Requirements: 7.2, 7.5_

  - [ ]* 18.3 Write property test for workflow integration completeness
    - **Property 15: Workflow integration completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [ ]* 18.4 Write property test for custom workflow support
    - **Property 16: Custom workflow support**
    - **Validates: Requirements 7.5**

- [ ] 19. Install and configure authentication plugins (existing community plugins)
  - [ ] 19.1 Install @red-hat/backstage-plugin-keycloak for OIDC integration
    - Install the community Keycloak plugin from Red Hat
    - Configure Keycloak OIDC provider alongside GitHub OAuth
    - Set up single sign-on for all integrated tools
    - Configure role-based access controls for sensitive information
    - _Requirements: 8.1, 8.3, 8.4_

  - [ ] 17.2 Add contractor permission management
    - Implement contractor-specific RBAC policies and access boundaries
    - Add permission update synchronization with 5-minute SLA
    - Create approval workflows for contractor access requests
    - _Requirements: 8.2, 8.5_

  - [ ]* 17.3 Write property test for authentication and SSO
    - **Property 17: Authentication and SSO**
    - **Validates: Requirements 8.1, 8.3, 8.5**

  - [ ]* 17.4 Write property test for permission management
    - **Property 18: Permission management**
    - **Validates: Requirements 8.2, 8.4**

- [ ] 18. Implement platform analytics and monitoring
  - [ ] 18.1 Create platform usage tracking
    - Implement daily active user tracking and feature usage metrics
    - Create health dashboards for all integrated systems
    - Add adoption analysis showing team and service usage patterns
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 18.2 Add privacy-compliant analytics
    - Implement usage analytics for improvement planning
    - Ensure privacy requirements compliance with data aggregation
    - Create success metrics dashboards with defined KPIs
    - _Requirements: 13.4, 13.5_

  - [ ]* 18.3 Write property test for platform metrics and health
    - **Property 27: Platform metrics and health**
    - **Validates: Requirements 13.1, 13.2**

  - [ ]* 18.4 Write property test for analytics and privacy
    - **Property 28: Analytics and privacy**
    - **Validates: Requirements 13.3, 13.4, 13.5**

- [ ] 19. Checkpoint - Core platform MVP complete
  - Ensure all tests pass, ask the user if questions arise.
  - **Checkpoint commit**: `git add . && git commit -m "checkpoint: core platform MVP with all plugins complete" && git tag -a "checkpoint-3" -m "Checkpoint 3: Complete MVP" && git push origin main --tags`

- [ ] 20. Develop Feishu migration plugin (Phase 2)
  - [ ] 20.1 Create @internal/plugin-feishu-migration
    - Implement Feishu workspace scanning and document discovery
    - Create document conversion engine for Markdown transformation
    - Add permission mapping and validation capabilities
    - _Requirements: 5.5_

  - [ ]* 20.2 Write integration test for Feishu document migration
    - Test conversion accuracy, permission mapping, and rollback capabilities
    - _Requirements: 5.5_

- [ ] 17. Implement AI Gateway and assistant plugin (Phase 2)
- [ ] 21. Enhance AI capabilities with custom integrations (Phase 2)
  - [ ] 21.1 Configure Spotify AI Gateway with multiple LLM providers
    - Set up OpenAI, AWS Bedrock, and Azure provider configurations
    - Implement automatic failover and circuit breaker patterns
    - Add sensitive content filtering and AI output watermarking
    - _Requirements: 10.1, 10.2, 10.4_

  - [ ] 21.2 Enhance @roadie/backstage-plugin-ai-assistant with custom features
    - Extend existing AI Assistant plugin with company-specific patterns
    - Add integration with internal documentation and code repositories
    - Implement custom AI workflows for development tasks
    - _Requirements: 10.1, 10.2, 10.4_

  - [ ] 21.3 Add AI troubleshooting and learning capabilities
    - Implement AI-powered root cause analysis for issues
    - Add company-specific pattern learning and contextual suggestions
    - Ensure AI respects user roles and permission boundaries
    - _Requirements: 10.3, 10.5_

  - [ ]* 21.4 Write property test for AI development assistance
    - **Property 21: AI development assistance**
    - **Validates: Requirements 10.1, 10.2, 10.4**

  - [ ]* 21.5 Write property test for AI troubleshooting and learning
    - **Property 22: AI troubleshooting and learning**
    - **Validates: Requirements 10.3, 10.5**

- [ ] 18. Develop AIOps intelligence plugin (Phase 2)
- [ ] 22. Develop AIOps intelligence plugin (Phase 2)
  - [ ] 22.1 Create @internal/plugin-aiops for operations intelligence
    - Implement anomaly detection and failure prediction algorithms
    - Create AI-generated runbook system based on historical incidents
    - Add resource optimization recommendations using ML analysis
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 22.2 Add deployment risk assessment and signal correlation
    - Implement AI-powered deployment risk analysis
    - Create signal correlation across Datadog and Sentry systems
    - Add confidence scoring and data freshness tracking
    - _Requirements: 11.4, 11.5_

  - [ ]* 22.3 Write property test for AI operations intelligence
    - **Property 23: AI operations intelligence**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

  - [ ]* 22.4 Write property test for signal correlation
    - **Property 24: Signal correlation**
    - **Validates: Requirements 11.5**

- [ ] 19. Implement AI resource optimization (Phase 2)
- [ ] 23. Implement AI resource optimization (Phase 2)
  - [ ] 23.1 Create intelligent resource optimization system
    - Implement AI-generated optimization recommendations for inefficient services
    - Add ML-based cost anomaly detection and driver identification
    - Create auto-scaling recommendations based on traffic patterns
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 23.2 Add performance benchmarking and cost-performance analysis
    - Implement AI performance benchmarking for similar services
    - Create comprehensive cost-performance analysis with OpenCost and AWS data
    - Add configuration improvement suggestions
    - _Requirements: 12.4, 12.5_

  - [ ]* 23.3 Write property test for AI resource optimization
    - **Property 25: AI resource optimization**
    - **Validates: Requirements 12.1, 12.2, 12.3**

  - [ ]* 23.4 Write property test for performance benchmarking
    - **Property 26: Performance benchmarking and cost analysis**
    - **Validates: Requirements 12.4, 12.5**

- [ ] 20. Implement security and compliance plugin
- [ ] 24. Implement security and compliance plugin
  - [ ] 24.1 Create @internal/plugin-security for AI safety
    - Implement sensitive content filtering for AI outputs
    - Add user permission validation for AI-generated content
    - Create audit trail for all AI interactions
    - Add contractor access control validation

  - [ ]* 24.2 Write security integration tests
    - Test AI audit trail, contractor access controls, and sensitive content filtering

- [ ] 21. Final integration and testing
- [ ] 25. Final integration and testing
  - [ ] 25.1 Implement comprehensive error handling
    - Add circuit breakers for all external API integrations
    - Implement graceful degradation for plugin failures
    - Add cost data variance alerts and TechDocs build notifications

  - [ ] 25.2 Performance optimization and monitoring
    - Implement request throttling and priority queuing
    - Add database connection pooling with failover
    - Configure plugin sandboxing using Web Workers

  - [ ]* 25.3 Write end-to-end integration tests
    - Test complete service creation workflow from template to monitoring
    - Test cross-plugin data consistency and real-time updates

- [ ] 26. Final checkpoint - Complete platform validation
  - Ensure all tests pass, ask the user if questions arise.
  - **Final commit**: `git add . && git commit -m "feat: complete Internal Developer Platform implementation" && git tag -a "v1.0.0" -m "Release v1.0.0: Complete IDP with AI capabilities" && git push origin main --tags`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Phase 1 (Tasks 1-20) delivers core platform functionality for immediate value
- Phase 2 (Tasks 21-27) adds AI enhancements for advanced capabilities
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Integration tests ensure end-to-end functionality across all components
- The implementation uses TypeScript throughout for type safety and Backstage compatibility

### Git Commit Guidelines

**After completing each major task, commit your changes using this format:**

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: [task-description]"

# Push to remote repository
git push origin main
```

**Commit Message Format:**
- `feat:` for new features and plugin integrations
- `test:` for adding tests and property-based testing
- `config:` for configuration changes and setup
- `docs:` for documentation updates
- `fix:` for bug fixes and corrections

**Examples:**
- `feat: integrate Datadog plugin for dashboard embedding`
- `test: add property tests for service catalog completeness`
- `config: setup PostgreSQL database connection`
- `feat: implement Golden Path templates for Java and Go`

**Checkpoint Commits:**
At each checkpoint task (4, 15, 19, 26), create a tagged commit:
```bash
git tag -a "checkpoint-[number]" -m "Checkpoint [number]: [description]"
git push origin --tags
```

### Backstage Production Configuration Best Practices

Based on official Backstage documentation, the following production configurations are applied:

**Docker Configuration:**
```dockerfile
# Multi-stage build with minimal hardened image
FROM cgr.dev/chainguard/wolfi-base:latest
# Security: Use non-root user
USER node
# Performance: Enable BuildKit caching
RUN --mount=type=cache,target=/home/node/.cache/yarn
```

**Kubernetes Configuration:**
```yaml
# Proper resource limits and health checks
resources:
  limits:
    memory: "2Gi"
    cpu: "1000m"
  requests:
    memory: "1Gi"
    cpu: "500m"
livenessProbe:
  httpGet:
    path: /healthcheck
    port: 7007
```

**Authentication Configuration:**
```yaml
auth:
  # Production token signing
  keys:
    - use: sig
      kty: EC
      kid: backstage-key
      crv: P-256
  # Environment-specific providers
  environment: production
```

**Catalog Configuration:**
```yaml
catalog:
  # Optimized processing intervals
  processingInterval: { minutes: 30 }
  # Deferred stitching for performance
  stitchingStrategy: deferred
  # Error handling and monitoring
  orphanStrategy: delete
```

**Database Configuration:**
```yaml
backend:
  database:
    connection:
      # Production PostgreSQL with connection pooling
      max: 25
      acquireTimeoutMillis: 60000
      createTimeoutMillis: 30000
      destroyTimeoutMillis: 5000
      idleTimeoutMillis: 30000
```

### Git Workflow Best Practices

1. **Frequent Commits**: Commit after completing each sub-task or significant change
2. **Descriptive Messages**: Use clear, descriptive commit messages that explain what was implemented
3. **Branch Strategy**: Work on feature branches for major tasks, merge to main after completion
4. **Testing Before Commit**: Always run tests before committing to ensure code quality
5. **Documentation Updates**: Include documentation updates in the same commit as the feature

### Automated Git Hooks (Optional)

Consider setting up git hooks to automate quality checks:

```bash
# Pre-commit hook example (.git/hooks/pre-commit)
#!/bin/sh
npm run lint
npm run test
npm run build
```

This ensures code quality and prevents broken commits from being pushed to the repository.

### Community Plugins Used (Reduces Development Time by ~80%)

**Observability & Monitoring:**
- **@roadie/backstage-plugin-datadog**: Dashboard embedding and monitoring
- **@spotify/backstage-plugin-sentry**: Error tracking and alerting
- **@roadie/backstage-plugin-prometheus**: Metrics and alerting
- **@k-phoen/backstage-plugin-grafana**: Dashboard integration
- **@deepankumar/backstage-plugin-jaeger**: Distributed tracing
- **@roadie/backstage-plugin-security-insights**: Vulnerability management
- **@spotify/backstage-plugin-lighthouse**: Performance monitoring

**CI/CD & Development Workflow:**
- **@spotify/backstage-plugin-github-actions**: CI/CD visibility
- **@roadie/backstage-plugin-github-pull-requests**: PR management
- **@spotify/backstage-plugin-ci-cd-statistics**: Build analytics
- **@roadie/backstage-plugin-scaffolder-git-actions**: Enhanced scaffolding
- **Changelog Viewer Plugin**: Release and version tracking
- **Jenkins Plugin**: CI/CD integration for Jenkins users
- **GitHub Insights Plugin**: Repository and team analytics

**Kubernetes & Infrastructure:**
- **@red-hat/backstage-plugin-topology**: Kubernetes visualization
- **@spreadgroup/backstage-plugin-vault**: Secrets management
- **@red-hat/backstage-plugin-nexus**: Artifact management
- **Terraform Provider Plugin**: Infrastructure as code management
- **GitOps Clusters Plugin**: Multi-cluster GitOps management
- **Kiali Service Mesh Plugin**: Istio service mesh observability
- **Kubelog Plugin**: Kubernetes log viewing and streaming

**Developer Experience:**
- **@sda-se/backstage-plugin-api-docs**: API documentation
- **@zalopay-oss/backstage-plugin-grpc-playground**: gRPC testing
- **@spotify/backstage-plugin-todo**: Code quality tracking
- **@drodil/backstage-plugin-toolbox**: Developer utilities
- **@keyloop/backstage-plugin-devtools**: Diagnostics
- **Catalog Graph Plugin**: Service dependency visualization
- **API SDK Generator Plugin**: Automated SDK generation
- **@roadie/backstage-plugin-tech-insights**: Quality scorecards
- **@spotify/backstage-plugin-tech-radar**: Technology tracking

**Cost & Resource Management:**
- **@mattray/backstage-plugin-opencost**: Kubernetes cost visibility

**AI & Engineering Insights:**
- **@roadie/backstage-plugin-ai-assistant**: AI-powered assistance with RAG capabilities
- **@opslevel/backstage-plugin-service-maturity**: Service quality and maturity management
- **@devoteam/backstage-plugin-opendora**: DORA metrics tracking
- **@cortex/backstage-plugin-dx**: Engineering effectiveness
- **@firehydrant/backstage-plugin-firehydrant**: Incident management and reliability
- **@veecode/backstage-plugin-kubernetes-gpt-analyzer**: AI troubleshooting

**Collaboration & Workflow:**
- **@roadie/backstage-plugin-jira**: Issue tracking integration
- **@dazn/backstage-plugin-github-pull-requests-board**: PR management
- **@drew-hill/backstage-plugin-slack-scaffolder-actions**: Notifications
- **@red-hat/backstage-plugin-feedback**: User feedback
- **Jira Dashboard Plugin**: Enhanced project tracking and dashboards
- **Shortcut Plugin**: Agile project management (Jira alternative)
- **@roadie/backstage-plugin-buildkite**: CI/CD integration (Buildkite)
- **@spotify/backstage-plugin-cost-insights**: Cloud cost management

**Development Environments:**
- **@coder/backstage-plugin-devpod**: Development environments
- **@coder/backstage-plugin-dev-containers**: VS Code integration
- **@spotify/backstage-plugin-google-calendar**: Team coordination

**Authentication & Security:**
- **@red-hat/backstage-plugin-keycloak**: OIDC integration and RBAC

### Custom Plugins Still Required
- **@internal/plugin-n8n-actions**: Workflow automation integration
- **@internal/plugin-feishu-migration**: Document migration from Feishu
- **AI Gateway enhancements**: Custom AI integrations and company-specific patterns
- **@internal/plugin-aiops**: AIOps intelligence and automation
- **@internal/plugin-security**: AI safety and compliance