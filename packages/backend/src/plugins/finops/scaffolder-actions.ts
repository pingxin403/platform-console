/**
 * Backstage Scaffolder Actions for FinOps Cost Gating
 * 
 * Provides custom scaffolder actions for pre-deployment cost validation
 */

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { CostEstimationEngine } from './cost-estimation-engine';
import { BudgetManager } from './budget-manager';
import { DeploymentSpec } from './types';

export interface CostGateActionConfig {
  costEngine: CostEstimationEngine;
  budgetManager: BudgetManager;
}

/**
 * Create cost gate validation action
 */
export function createCostGateAction(config: CostGateActionConfig) {
  const { costEngine, budgetManager } = config;

  return createTemplateAction<{
    serviceId: string;
    cpu: string;
    memory: string;
    storage?: string;
    replicas: number;
    environment?: 'development' | 'staging' | 'production';
    failOnBudgetExceeded?: boolean;
  }>({
    id: 'finops:validate-cost',
    description: 'Validates deployment cost against service budget',
    schema: {
      input: {
        type: 'object',
        required: ['serviceId', 'cpu', 'memory', 'replicas'],
        properties: {
          serviceId: {
            type: 'string',
            title: 'Service ID',
            description: 'The ID of the service to validate',
          },
          cpu: {
            type: 'string',
            title: 'CPU',
            description: 'CPU request (e.g., "2" or "2000m")',
          },
          memory: {
            type: 'string',
            title: 'Memory',
            description: 'Memory request (e.g., "4Gi" or "4096Mi")',
          },
          storage: {
            type: 'string',
            title: 'Storage',
            description: 'Storage request (e.g., "10Gi")',
          },
          replicas: {
            type: 'number',
            title: 'Replicas',
            description: 'Number of replicas',
          },
          environment: {
            type: 'string',
            title: 'Environment',
            description: 'Deployment environment',
            enum: ['development', 'staging', 'production'],
          },
          failOnBudgetExceeded: {
            type: 'boolean',
            title: 'Fail on Budget Exceeded',
            description: 'Whether to fail the action if budget is exceeded',
            default: true,
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          isValid: {
            type: 'boolean',
            title: 'Is Valid',
            description: 'Whether the deployment is within budget',
          },
          estimatedCost: {
            type: 'number',
            title: 'Estimated Cost',
            description: 'Estimated monthly cost in USD',
          },
          remainingBudget: {
            type: 'number',
            title: 'Remaining Budget',
            description: 'Remaining budget in USD',
          },
          requiresApproval: {
            type: 'boolean',
            title: 'Requires Approval',
            description: 'Whether approval is required',
          },
          approvalUrl: {
            type: 'string',
            title: 'Approval URL',
            description: 'URL to request approval',
          },
          message: {
            type: 'string',
            title: 'Message',
            description: 'Validation message',
          },
        },
      },
    },
    async handler(ctx) {
      const {
        serviceId,
        cpu,
        memory,
        storage,
        replicas,
        environment,
        failOnBudgetExceeded = true,
      } = ctx.input;

      ctx.logger.info(`Validating cost for service: ${serviceId}`);

      try {
        // Create deployment spec
        const spec: DeploymentSpec = {
          cpu,
          memory,
          storage,
          replicas,
          environment,
        };

        // Estimate cost
        ctx.logger.info('Estimating deployment cost...');
        const costEstimate = await costEngine.estimateDeploymentCost(spec);
        ctx.logger.info(
          `Estimated monthly cost: $${costEstimate.estimatedMonthlyCost.toFixed(2)}`
        );

        // Get current monthly cost (simplified - in production, fetch from OpenCost)
        const currentMonthlyCost = 0; // TODO: Fetch actual current cost

        // Validate budget
        ctx.logger.info('Validating budget...');
        const validation = await budgetManager.validateBudget(
          serviceId,
          costEstimate,
          currentMonthlyCost
        );

        // Set output
        ctx.output('isValid', validation.isValid);
        ctx.output('estimatedCost', validation.estimatedCost);
        ctx.output('remainingBudget', validation.remainingBudget);
        ctx.output('requiresApproval', validation.requiresApproval);
        if (validation.approvalUrl) {
          ctx.output('approvalUrl', validation.approvalUrl);
        }
        if (validation.message) {
          ctx.output('message', validation.message);
        }

        // Log validation result
        if (validation.isValid) {
          ctx.logger.info(`✓ Cost validation passed: ${validation.message}`);
        } else {
          ctx.logger.warn(`✗ Cost validation failed: ${validation.message}`);
          if (validation.approvalUrl) {
            ctx.logger.info(`Approval URL: ${validation.approvalUrl}`);
          }
        }

        // Fail the action if budget is exceeded and failOnBudgetExceeded is true
        if (!validation.isValid && failOnBudgetExceeded) {
          throw new Error(
            `Deployment blocked: ${validation.message}\n` +
            (validation.approvalUrl
              ? `Request approval at: ${validation.approvalUrl}`
              : 'Please contact your platform team for approval.')
          );
        }
      } catch (error) {
        ctx.logger.error(`Cost validation error: ${error}`);
        throw error;
      }
    },
  });
}

/**
 * Create budget management action
 */
export function createBudgetManagementAction(config: CostGateActionConfig) {
  const { budgetManager } = config;

  return createTemplateAction<{
    action: 'create' | 'update' | 'delete' | 'get';
    serviceId: string;
    monthlyBudget?: number;
    alertThreshold?: number;
    userId?: string;
  }>({
    id: 'finops:manage-budget',
    description: 'Manages service budgets (CRUD operations)',
    schema: {
      input: {
        type: 'object',
        required: ['action', 'serviceId'],
        properties: {
          action: {
            type: 'string',
            title: 'Action',
            description: 'Budget management action',
            enum: ['create', 'update', 'delete', 'get'],
          },
          serviceId: {
            type: 'string',
            title: 'Service ID',
            description: 'The ID of the service',
          },
          monthlyBudget: {
            type: 'number',
            title: 'Monthly Budget',
            description: 'Monthly budget in USD',
          },
          alertThreshold: {
            type: 'number',
            title: 'Alert Threshold',
            description: 'Alert threshold percentage (0-100)',
          },
          userId: {
            type: 'string',
            title: 'User ID',
            description: 'User performing the action',
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          budget: {
            type: 'object',
            title: 'Budget',
            description: 'Service budget object',
          },
        },
      },
    },
    async handler(ctx) {
      const { action, serviceId, monthlyBudget, alertThreshold, userId = 'system' } = ctx.input;

      ctx.logger.info(`Executing budget ${action} for service: ${serviceId}`);

      try {
        switch (action) {
          case 'create':
            if (!monthlyBudget) {
              throw new Error('monthlyBudget is required for create action');
            }
            const created = await budgetManager.createBudget(
              { serviceId, monthlyBudget, alertThreshold },
              userId
            );
            ctx.output('budget', created);
            ctx.logger.info(`Budget created: $${monthlyBudget}/month`);
            break;

          case 'update':
            const updated = await budgetManager.updateBudget(
              serviceId,
              { monthlyBudget, alertThreshold },
              userId
            );
            ctx.output('budget', updated);
            ctx.logger.info('Budget updated successfully');
            break;

          case 'delete':
            await budgetManager.deleteBudget(serviceId);
            ctx.logger.info('Budget deleted successfully');
            break;

          case 'get':
            const budget = await budgetManager.getBudget(serviceId);
            if (!budget) {
              throw new Error(`Budget not found for service: ${serviceId}`);
            }
            ctx.output('budget', budget);
            ctx.logger.info(`Budget retrieved: $${budget.monthlyBudget}/month`);
            break;

          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        ctx.logger.error(`Budget management error: ${error}`);
        throw error;
      }
    },
  });
}
