/**
 * Budget Manager
 * 
 * Provides CRUD operations for service budgets
 * Implements budget validation and gating logic
 */

import {
  ServiceBudget,
  BudgetValidation,
  BudgetCreateRequest,
  BudgetUpdateRequest,
  CostEstimate,
} from './types';

export interface BudgetManagerConfig {
  approvalWorkflow?: {
    enabled: boolean;
    githubOrg?: string;
    githubRepo?: string;
  };
}

export class BudgetManager {
  private budgets: Map<string, ServiceBudget>;
  private config: BudgetManagerConfig;

  constructor(config: BudgetManagerConfig = {}) {
    this.budgets = new Map();
    this.config = config;
  }

  /**
   * Create a new budget for a service
   */
  async createBudget(
    request: BudgetCreateRequest,
    userId: string,
  ): Promise<ServiceBudget> {
    const { serviceId, monthlyBudget, alertThreshold = 80 } = request;

    // Validate inputs
    if (monthlyBudget <= 0) {
      throw new Error('Monthly budget must be greater than 0');
    }

    if (alertThreshold < 0 || alertThreshold > 100) {
      throw new Error('Alert threshold must be between 0 and 100');
    }

    // Check if budget already exists
    const existing = await this.getBudget(serviceId);
    if (existing) {
      throw new Error(`Budget already exists for service ${serviceId}`);
    }

    const budget: ServiceBudget = {
      id: this.generateId(),
      serviceId,
      monthlyBudget,
      currency: 'USD',
      alertThreshold,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    this.budgets.set(serviceId, budget);
    return budget;
  }

  /**
   * Get budget for a service
   */
  async getBudget(serviceId: string): Promise<ServiceBudget | null> {
    return this.budgets.get(serviceId) || null;
  }

  /**
   * Update budget for a service
   */
  async updateBudget(
    serviceId: string,
    request: BudgetUpdateRequest,
    userId: string,
  ): Promise<ServiceBudget> {
    const existing = await this.getBudget(serviceId);
    if (!existing) {
      throw new Error(`Budget not found for service ${serviceId}`);
    }

    // Validate inputs
    if (request.monthlyBudget !== undefined && request.monthlyBudget <= 0) {
      throw new Error('Monthly budget must be greater than 0');
    }

    if (
      request.alertThreshold !== undefined &&
      (request.alertThreshold < 0 || request.alertThreshold > 100)
    ) {
      throw new Error('Alert threshold must be between 0 and 100');
    }

    const updated: ServiceBudget = {
      ...existing,
      monthlyBudget: request.monthlyBudget ?? existing.monthlyBudget,
      alertThreshold: request.alertThreshold ?? existing.alertThreshold,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    this.budgets.set(serviceId, updated);
    return updated;
  }

  /**
   * Delete budget for a service
   */
  async deleteBudget(serviceId: string): Promise<void> {
    const existing = await this.getBudget(serviceId);
    if (!existing) {
      throw new Error(`Budget not found for service ${serviceId}`);
    }

    this.budgets.delete(serviceId);
  }

  /**
   * List all budgets
   */
  async listBudgets(): Promise<ServiceBudget[]> {
    return Array.from(this.budgets.values());
  }

  /**
   * Validate budget for a deployment
   */
  async validateBudget(
    serviceId: string,
    costEstimate: CostEstimate,
    currentMonthlyCost: number = 0,
  ): Promise<BudgetValidation> {
    const budget = await this.getBudget(serviceId);

    // If no budget is set, allow deployment with warning
    if (!budget) {
      return {
        isValid: true,
        currentBudget: 0,
        estimatedCost: costEstimate.estimatedMonthlyCost,
        remainingBudget: 0,
        requiresApproval: false,
        message: 'No budget configured for this service. Deployment allowed.',
      };
    }

    const estimatedCost = costEstimate.estimatedMonthlyCost;
    const projectedTotalCost = currentMonthlyCost + estimatedCost;
    const remainingBudget = budget.monthlyBudget - currentMonthlyCost;

    // Check if estimated cost exceeds remaining budget
    if (estimatedCost > remainingBudget) {
      const approvalUrl = this.config.approvalWorkflow?.enabled
        ? await this.createApprovalRequest(serviceId, budget, costEstimate)
        : undefined;

      return {
        isValid: false,
        currentBudget: budget.monthlyBudget,
        estimatedCost,
        remainingBudget,
        requiresApproval: true,
        approvalUrl,
        message: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds remaining budget ($${remainingBudget.toFixed(2)}). Approval required.`,
      };
    }

    // Check if projected total cost exceeds budget
    if (projectedTotalCost > budget.monthlyBudget) {
      const approvalUrl = this.config.approvalWorkflow?.enabled
        ? await this.createApprovalRequest(serviceId, budget, costEstimate)
        : undefined;

      return {
        isValid: false,
        currentBudget: budget.monthlyBudget,
        estimatedCost,
        remainingBudget,
        requiresApproval: true,
        approvalUrl,
        message: `Projected total cost ($${projectedTotalCost.toFixed(2)}) exceeds monthly budget ($${budget.monthlyBudget.toFixed(2)}). Approval required.`,
      };
    }

    // Check if approaching alert threshold
    const utilizationPercent = (projectedTotalCost / budget.monthlyBudget) * 100;
    if (utilizationPercent >= budget.alertThreshold) {
      return {
        isValid: true,
        currentBudget: budget.monthlyBudget,
        estimatedCost,
        remainingBudget,
        requiresApproval: false,
        message: `Warning: Projected cost utilization (${utilizationPercent.toFixed(1)}%) is approaching budget threshold (${budget.alertThreshold}%).`,
      };
    }

    return {
      isValid: true,
      currentBudget: budget.monthlyBudget,
      estimatedCost,
      remainingBudget,
      requiresApproval: false,
      message: `Deployment approved. Estimated cost: $${estimatedCost.toFixed(2)}, Remaining budget: $${remainingBudget.toFixed(2)}.`,
    };
  }

  /**
   * Create approval request (GitHub Issue for MVP)
   */
  private async createApprovalRequest(
    serviceId: string,
    budget: ServiceBudget,
    costEstimate: CostEstimate,
  ): Promise<string> {
    const { githubOrg, githubRepo } = this.config.approvalWorkflow || {};

    if (!githubOrg || !githubRepo) {
      // Return a placeholder URL if GitHub integration is not configured
      return `https://github.com/${githubOrg || 'your-org'}/${githubRepo || 'approvals'}/issues/new?title=Budget+Approval+Required+for+${serviceId}`;
    }

    // In production, this would create a GitHub Issue via API
    // For MVP, we return a URL to create an issue manually
    const title = encodeURIComponent(`Budget Approval Required: ${serviceId}`);
    const body = encodeURIComponent(
      `## Budget Approval Request\n\n` +
      `**Service:** ${serviceId}\n` +
      `**Monthly Budget:** $${budget.monthlyBudget.toFixed(2)}\n` +
      `**Estimated Cost:** $${costEstimate.estimatedMonthlyCost.toFixed(2)}\n\n` +
      `### Cost Breakdown\n` +
      `**Kubernetes:**\n` +
      `- CPU: $${costEstimate.breakdown.kubernetes.cpu.toFixed(2)}\n` +
      `- Memory: $${costEstimate.breakdown.kubernetes.memory.toFixed(2)}\n` +
      `- Storage: $${costEstimate.breakdown.kubernetes.storage.toFixed(2)}\n\n` +
      `**AWS:**\n` +
      `- RDS: $${costEstimate.breakdown.aws.rds.toFixed(2)}\n` +
      `- S3: $${costEstimate.breakdown.aws.s3.toFixed(2)}\n` +
      `- Other: $${costEstimate.breakdown.aws.other.toFixed(2)}\n\n` +
      `Please review and approve this deployment.`
    );

    return `https://github.com/${githubOrg}/${githubRepo}/issues/new?title=${title}&body=${body}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
