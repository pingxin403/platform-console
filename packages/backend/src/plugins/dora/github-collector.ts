/**
 * GitHub data collector for DORA metrics
 * 
 * Collects pull request data from GitHub including:
 * - Lead time for changes (commit to merge time)
 * - Code review metrics
 * - Deployment correlation
 */

import { Logger } from 'winston';
import { Octokit } from '@octokit/rest';
import { PullRequestData, DORACollectorConfig, CollectionResult } from './types';

export class GitHubCollector {
  private readonly logger: Logger;
  private readonly config: DORACollectorConfig['github'];
  private readonly octokit: Octokit;

  constructor(logger: Logger, config: DORACollectorConfig['github']) {
    this.logger = logger;
    this.config = config;
    
    this.octokit = new Octokit({
      auth: config.token,
      userAgent: 'backstage-dora-collector',
    });
  }

  /**
   * Collect pull request data from GitHub
   */
  async collectPullRequests(
    startDate: Date,
    endDate: Date,
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const pullRequests: PullRequestData[] = [];

    try {
      this.logger.info('Starting GitHub PR data collection', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        organizations: this.config.organizations,
      });

      // Collect PRs from each organization
      for (const org of this.config.organizations) {
        try {
          const orgPRs = await this.collectOrganizationPRs(
            org,
            startDate,
            endDate,
          );
          pullRequests.push(...orgPRs);
        } catch (error) {
          const errorMsg = `Failed to collect PRs for organization ${org}: ${error}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const duration = Date.now() - startTime;
      
      this.logger.info('GitHub PR data collection completed', {
        recordsCollected: pullRequests.length,
        duration,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        source: 'github',
        recordsCollected: pullRequests.length,
        errors,
        collectedAt: new Date(),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `GitHub collection failed: ${error}`;
      this.logger.error(errorMsg);
      
      return {
        success: false,
        source: 'github',
        recordsCollected: 0,
        errors: [errorMsg],
        collectedAt: new Date(),
        duration,
      };
    }
  }

  /**
   * Collect PRs from an organization
   */
  private async collectOrganizationPRs(
    org: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PullRequestData[]> {
    const pullRequests: PullRequestData[] = [];
    
    try {
      // Get all repositories in the organization
      const repos = await this.getOrganizationRepositories(org);
      
      this.logger.info(`Found ${repos.length} repositories in ${org}`);

      // Collect PRs from each repository
      for (const repo of repos) {
        try {
          const repoPRs = await this.collectRepositoryPRs(
            org,
            repo.name,
            startDate,
            endDate,
          );
          pullRequests.push(...repoPRs);
        } catch (error) {
          this.logger.warn(`Failed to collect PRs for ${org}/${repo.name}`, {
            error,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get repositories for ${org}`, { error });
      throw error;
    }
    
    return pullRequests;
  }

  /**
   * Get all repositories in an organization
   */
  private async getOrganizationRepositories(org: string): Promise<any[]> {
    const repos: any[] = [];
    let page = 1;
    const perPage = 100;

    try {
      while (true) {
        const response = await this.octokit.repos.listForOrg({
          org,
          type: 'all',
          per_page: perPage,
          page,
        });

        repos.push(...response.data);

        if (response.data.length < perPage) {
          break;
        }

        page++;
      }
    } catch (error) {
      this.logger.error(`Failed to list repositories for ${org}`, { error });
      throw error;
    }

    return repos;
  }

  /**
   * Collect PRs from a repository
   */
  private async collectRepositoryPRs(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PullRequestData[]> {
    const pullRequests: PullRequestData[] = [];
    let page = 1;
    const perPage = 100;

    try {
      while (true) {
        const response = await this.octokit.pulls.list({
          owner,
          repo,
          state: 'closed',
          sort: 'updated',
          direction: 'desc',
          per_page: perPage,
          page,
        });

        for (const pr of response.data) {
          // Only include merged PRs
          if (!pr.merged_at) {
            continue;
          }

          const mergedAt = new Date(pr.merged_at);
          
          // Filter by date range
          if (mergedAt >= startDate && mergedAt <= endDate) {
            const prData = await this.getPullRequestDetails(owner, repo, pr.number);
            if (prData) {
              pullRequests.push(prData);
            }
          }
          
          // Stop if we've gone past the start date
          if (mergedAt < startDate) {
            return pullRequests;
          }
        }

        if (response.data.length < perPage) {
          break;
        }

        page++;
      }
    } catch (error) {
      this.logger.warn(`Failed to list PRs for ${owner}/${repo}`, { error });
    }

    return pullRequests;
  }

  /**
   * Get detailed PR information
   */
  private async getPullRequestDetails(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<PullRequestData | null> {
    try {
      // Get PR details
      const prResponse = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      const pr = prResponse.data;

      // Get first commit date
      const commitsResponse = await this.octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 1,
      });

      const firstCommit = commitsResponse.data[0];
      const firstCommitAt = firstCommit
        ? new Date(firstCommit.commit.author?.date || pr.created_at)
        : new Date(pr.created_at);

      // Get reviews to find approval date
      const reviewsResponse = await this.octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      });

      const approvedReview = reviewsResponse.data.find(
        review => review.state === 'APPROVED',
      );
      const approvedAt = approvedReview
        ? new Date(approvedReview.submitted_at!)
        : null;

      // Extract service ID from repository
      const serviceId = this.extractServiceId(owner, repo);

      const prData: PullRequestData = {
        serviceId,
        serviceName: repo,
        prNumber: pr.number,
        title: pr.title,
        createdAt: new Date(pr.created_at),
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        firstCommitAt,
        author: pr.user?.login || 'unknown',
        linesAdded: pr.additions || 0,
        linesDeleted: pr.deletions || 0,
        filesChanged: pr.changed_files || 0,
        reviewers: reviewsResponse.data.map(r => r.user?.login || 'unknown'),
        approvedAt,
      };

      return prData;
    } catch (error) {
      this.logger.warn(`Failed to get PR details for ${owner}/${repo}#${prNumber}`, {
        error,
      });
      return null;
    }
  }

  /**
   * Extract service ID from repository
   */
  private extractServiceId(owner: string, repo: string): string {
    // Try to get service ID from repository topics or use repo name
    return `${owner}/${repo}`;
  }

  /**
   * Get PR data for storage
   */
  getPullRequestData(): PullRequestData[] {
    // This would be called after collectPullRequests to get the collected data
    // For now, we'll implement this as part of the main collection flow
    return [];
  }
}
