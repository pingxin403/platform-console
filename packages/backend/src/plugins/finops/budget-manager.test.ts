/**
 * Budget Manager Tests
 */

import { BudgetManager } from './budget-manager';
import { CostEstimate } from './types';

describe('BudgetManager', () => {
  let budgetManager: BudgetManager;

  beforeEach(() => {
    budgetManager = new BudgetManager({
      approvalWorkflow: {
        enabled: true,
        githubOrg: 'test-org',
        githubRepo: 'test-repo',
      },
    });
  });

  describe('createBudget', () => {
    it('should create a budget successfully', async () => {
      const budget = await budgetManager.createBudget(
        {
          serviceId: 'test-service',
          monthlyBudget: 1000,
          alertThreshold: 80,
        },
        'test-user'
      );

      expect(budget).toMatchObject({
        serviceId: 'test-service',
        monthlyBudget: 1000,
        currency: 'USD',
        alertThreshold: 80,
        createdBy: 'test-user',
        updatedBy: 'test-user',
      });
      expect(budget.id).toBeDefined();
      expect(budget.createdAt).toBeInstanceOf(Date);
      expect(budget.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error if monthly budget is zero or negative', async () => {
      await expect(
        budgetManager.createBudget(
          {
            serviceId: 'test-service',
            monthlyBudget: 0,
          },
          'test-user'
        )
      ).rejects.toThrow('Monthly budget must be greater than 0');

      await expect(
        budgetManager.createBudget(
          {
            serviceId: 'test-service',
            monthlyBudget: -100,
          },
          'test-user'
        )
      ).rejects.toThrow('Monthly budget must be greater than 0');
    });

    it('should throw error if alert threshold is out of range', async () => {
      await expect(
        budgetManager.createBudget(
          {
            serviceId: 'test-service',
            monthlyBudget: 1000,
            alertThreshold: -10,
          },
          'test-user'
        )
      ).rejects.toThrow('Alert threshold must be between 0 and 100');

      await expect(
        budgetManager.createBudget(
          {
            serviceId: 'test-service',
            monthlyBudget: 1000,
            alertThreshold: 150,
          },
          'test-user'
        )
      ).rejects.toThrow('Alert threshold must be between 0 and 100');
    });

    it('should throw error if budget already exists', async () => {
      await budgetManager.createBudget(
        {
          serviceId: 'test-service',
          monthlyBudget: 1000,
        },
        'test-user'
      );

      await expect(
        budgetManager.createBudget(
          {
            serviceId: 'test-service',
            monthlyBudget: 2000,
          },
          'test-user'
        )
      ).rejects.toThrow('Budget already exists for service test-service');
    });

    it('should use default alert threshold if not provided', async () => {
      const budget = await budgetManager.createBudget(
        {
          serviceId: 'test-service',
          monthlyBudget: 1000,
        },
        'test-user'
      );

      expect(budget.alertThreshold).toBe(80);
    });
  });

  describe('getBudget', () => {
    it('should return budget if exists', async () => {
      await budgetManager.createBudget(
        {
          serviceId: 'test-service',
          monthlyBudget: 1000,
        },
        'test-user'
      );

      const budget = await budgetManager.getBudget('test-service');
      expect(budget).toBeDefined();
      expect(budget?.serviceId).toBe('test-service');
    });

    it('should return null if budget does not exist', async () => {
      const budget = await budgetManager.getBudget('non-existent-service');
      expect(budget).toBeNull();
    });
  });

  describe('updateBudget', () => {
    beforeEach(async () => {
      await budgetManager.createBudget(
        {
          serviceId: 'test-service',
          monthlyBudget: 1000,
          alertThreshold: 80,
        },
        'test-user'
      );
    });

    it('should update monthly budget', async () => {
      const updated = await budgetManager.updateBudget(
        'test-service',
        { monthlyBudget: 1500 },
        'test-user-2'
      );

      expect(updated.monthlyBudget).toBe(1500);
      expect(updated.alertThreshold).toBe(80); // unchanged
      expect(updated.updatedBy).toBe('test-user-2');
    });

    it('should update alert threshold', async () => {
      const updated = await budgetManager.updateBudget(
        'test-service',
        { alertThreshold: 90 },
        'test-user-2'
      );

      expect(updated.monthlyBudget).toBe(1000); // unchanged
      expect(updated.alertThreshold).toBe(90);
    });

    it('should update both fields', async () => {
      const updated = await budgetManager.updateBudget(
        'test-service',
        { monthlyBudget: 2000, alertThreshold: 85 },
        'test-user-2'
      );

      expect(updated.monthlyBudget).toBe(2000);
      expect(updated.alertThreshold).toBe(85);
    });

    it('should throw error if budget does not exist', async () => {
      await expect(
        budgetManager.updateBudget(
          'non-existent-service',
          { monthlyBudget: 1500 },
          'test-user'
        )
      ).rejects.toThrow('Budget not found for service non-existent-service');
    });

    it('should throw error if monthly budget is invalid', async () => {
      await expect(
        budgetManager.updateBudget(
          'test-service',
          { monthlyBudget: 0 },
          'test-user'
        )
      ).rejects.toThrow('Monthly budget must be greater than 0');
    });

    it('should throw error if alert threshold is invalid', async () => {
      await expect(
        budgetManager.updateBudget(
          'test-service',
          { alertThreshold: 150 },
          'test-user'
        )
      ).rejects.toThrow('Alert threshold must be between 0 and 100');
    });
  });

  describe('deleteBudget', () => {
    it('should delete budget successfully', async () => {
      await budgetManager.createBudget(
        {
          serviceId: 'test-service',
          monthlyBudget: 1000,
        },
        'test-user'
      );

      await budgetManager.deleteBudget('test-service');

      const budget = await budgetManager.getBudget('test-service');
      expect(budget).toBeNull();
    });

    it('should throw error if budget does not exist', async () => {
      await expect(
        budgetManager.deleteBudget('non-existent-service')
      ).rejects.toThrow('Budget not found for service non-existent-service');
    });
  });

  describe('listBudgets', () => {
    it('should return empty array if no budgets', async () => {
      const budgets = await budgetManager.listBudgets();
      expect(budgets).toEqual([]);
    });

    it('should return all budgets', async () => {
      await budgetManager.createBudget(
        { serviceId: 'service-1', monthlyBudget: 1000 },
        'test-user'
      );
      await budgetManager.createBudget(
        { serviceId: 'service-2', monthlyBudget: 2000 },
        'test-user'
      );

      const budgets = await budgetManager.listBudgets();
      expect(budgets).toHaveLength(2);
      expect(budgets.map(b => b.serviceId)).toContain('service-1');
      expect(budgets.map(b => b.serviceId)).toContain('service-2');
    });
  });

  describe('validateBudget', () => {
    const mockCostEstimate: CostEstimate = {
      estimatedMonthlyCost: 450,
      breakdown: {
        kubernetes: { cpu: 135, memory: 87, storage: 30, total: 252 },
        aws: { rds: 150, s3: 10, other: 38, total: 198 },
      },
      confidence: 0.85,
      currency: 'USD',
    };

    it('should allow deployment if no budget is set', async () => {
      const validation = await budgetManager.validateBudget(
        'test-service',
        mockCostEstimate
      );

      expect(validation.isValid).toBe(true);
      expect(validation.requiresApproval).toBe(false);
      expect(validation.message).toContain('No budget configured');
    });

    it('should allow deployment if within budget', async () => {
      await budgetManager.createBudget(
        { serviceId: 'test-service', monthlyBudget: 1000 },
        'test-user'
      );

      const validation = await budgetManager.validateBudget(
        'test-service',
        mockCostEstimate,
        100 // current cost
      );

      expect(validation.isValid).toBe(true);
      expect(validation.requiresApproval).toBe(false);
      expect(validation.estimatedCost).toBe(450);
      expect(validation.remainingBudget).toBe(900);
    });

    it('should block deployment if estimated cost exceeds remaining budget', async () => {
      await budgetManager.createBudget(
        { serviceId: 'test-service', monthlyBudget: 1000 },
        'test-user'
      );

      const validation = await budgetManager.validateBudget(
        'test-service',
        mockCostEstimate,
        700 // current cost
      );

      expect(validation.isValid).toBe(false);
      expect(validation.requiresApproval).toBe(true);
      expect(validation.approvalUrl).toBeDefined();
      expect(validation.message).toContain('exceeds remaining budget');
    });

    it('should block deployment if projected total exceeds budget', async () => {
      await budgetManager.createBudget(
        { serviceId: 'test-service', monthlyBudget: 500 },
        'test-user'
      );

      // Use a smaller cost estimate to test the projected total check
      const smallerEstimate: CostEstimate = {
        estimatedMonthlyCost: 40,
        breakdown: {
          kubernetes: { cpu: 15, memory: 10, storage: 5, total: 30 },
          aws: { rds: 5, s3: 3, other: 2, total: 10 },
        },
        confidence: 0.85,
        currency: 'USD',
      };

      const validation = await budgetManager.validateBudget(
        'test-service',
        smallerEstimate,
        470 // current cost (remaining: 30, estimated: 40 > remaining BUT projected: 510 > budget)
      );

      expect(validation.isValid).toBe(false);
      expect(validation.requiresApproval).toBe(true);
      // This will still trigger the "exceeds remaining budget" message since 40 > 30
      expect(validation.message).toContain('exceeds remaining budget');
    });

    it('should warn if approaching alert threshold', async () => {
      await budgetManager.createBudget(
        { serviceId: 'test-service', monthlyBudget: 1000, alertThreshold: 80 },
        'test-user'
      );

      const validation = await budgetManager.validateBudget(
        'test-service',
        mockCostEstimate,
        400 // current cost (projected: 850, 85% utilization)
      );

      expect(validation.isValid).toBe(true);
      expect(validation.requiresApproval).toBe(false);
      expect(validation.message).toContain('approaching budget threshold');
    });

    it('should generate approval URL when workflow is enabled', async () => {
      await budgetManager.createBudget(
        { serviceId: 'test-service', monthlyBudget: 400 },
        'test-user'
      );

      const validation = await budgetManager.validateBudget(
        'test-service',
        mockCostEstimate,
        0 // current cost (estimated 450 exceeds budget 400)
      );

      expect(validation.isValid).toBe(false);
      expect(validation.requiresApproval).toBe(true);
      expect(validation.approvalUrl).toBeDefined();
      expect(validation.approvalUrl).toContain('github.com');
      expect(validation.approvalUrl).toContain('test-org');
      expect(validation.approvalUrl).toContain('test-repo');
      expect(validation.approvalUrl).toContain('test-service');
    });
  });
});
