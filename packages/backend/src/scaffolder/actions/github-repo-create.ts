/**
 * Custom Scaffolder action for GitHub repository creation with automatic service registration
 * Validates: Requirements 2.4
 */

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { ScmIntegrationRegistry } from '@backstage/integration';
import { CatalogApi } from '@backstage/catalog-client';
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';

// Input schema for the GitHub repository creation action
const inputSchema = z.object({
  repoUrl: z.string().describe('Repository URL in the format github.com?owner=<owner>&repo=<repo>'),
  description: z.string().describe('Repository description'),
  visibility: z.enum(['public', 'private']).default('private').describe('Repository visibility'),
  defaultBranch: z.string().default('main').describe('Default branch name'),
  topics: z.array(z.string()).optional().describe('Repository topics/tags'),
  gitCommitMessage: z.string().default('Initial commit').describe('Initial commit message'),
  gitAuthorName: z.string().optional().describe('Git author name'),
  gitAuthorEmail: z.string().optional().describe('Git author email'),
  catalogInfoPath: z.string().default('/catalog-info.yaml').describe('Path to catalog-info.yaml file'),
  autoRegister: z.boolean().default(true).describe('Automatically register service in catalog'),
});

// Output schema for the action
const outputSchema = z.object({
  remoteUrl: z.string().describe('Remote repository URL'),
  repoContentsUrl: z.string().describe('Repository contents URL'),
  cloneUrl: z.string().describe('Repository clone URL'),
  catalogEntityRef: z.string().optional().describe('Catalog entity reference if auto-registered'),
});

export interface GitHubRepoCreateActionOptions {
  integrations: ScmIntegrationRegistry;
  catalogApi: CatalogApi;
  config: Config;
  logger: Logger;
}

/**
 * Creates a custom Scaffolder action for GitHub repository creation with automatic service registration
 */
export function createGitHubRepoCreateAction(options: GitHubRepoCreateActionOptions) {
  const { integrations, catalogApi, config, logger } = options;

  return createTemplateAction<typeof inputSchema, typeof outputSchema>({
    id: 'github:repo:create',
    description: 'Create a GitHub repository and automatically register the service in the catalog',
    schema: {
      input: inputSchema,
      output: outputSchema,
    },
    async handler(ctx) {
      const {
        repoUrl,
        description,
        visibility,
        defaultBranch,
        topics,
        gitCommitMessage,
        gitAuthorName,
        gitAuthorEmail,
        catalogInfoPath,
        autoRegister,
      } = ctx.input;

      // Parse repository URL
      const { owner, repo } = parseRepoUrl(repoUrl);
      
      // Get GitHub integration
      const integration = integrations.github.byUrl(`https://github.com/${owner}/${repo}`);
      if (!integration) {
        throw new Error(`No GitHub integration found for ${owner}/${repo}`);
      }

      // Initialize Octokit client
      const octokit = new Octokit({
        auth: integration.config.token,
        baseUrl: integration.config.apiBaseUrl,
      });

      ctx.logger.info(`Creating GitHub repository: ${owner}/${repo}`);

      try {
        // Create the repository
        const createRepoResponse = await octokit.rest.repos.create({
          name: repo,
          description,
          private: visibility === 'private',
          auto_init: false, // We'll initialize with our own content
          default_branch: defaultBranch,
        });

        const remoteUrl = createRepoResponse.data.html_url;
        const cloneUrl = createRepoResponse.data.clone_url;
        const repoContentsUrl = `${remoteUrl}/blob/${defaultBranch}`;

        ctx.logger.info(`Repository created successfully: ${remoteUrl}`);

        // Add topics if provided
        if (topics && topics.length > 0) {
          await octokit.rest.repos.replaceAllTopics({
            owner,
            repo,
            names: topics,
          });
          ctx.logger.info(`Added topics to repository: ${topics.join(', ')}`);
        }

        // Initialize repository with content from workspace
        await initializeRepositoryContent(ctx, octokit, owner, repo, defaultBranch, {
          gitCommitMessage,
          gitAuthorName,
          gitAuthorEmail,
        });

        let catalogEntityRef: string | undefined;

        // Automatically register service in catalog if enabled
        if (autoRegister) {
          try {
            catalogEntityRef = await registerServiceInCatalog(
              catalogApi,
              repoContentsUrl,
              catalogInfoPath,
              logger
            );
            ctx.logger.info(`Service automatically registered in catalog: ${catalogEntityRef}`);
          } catch (error) {
            ctx.logger.warn(`Failed to auto-register service in catalog: ${error}`);
            // Don't fail the entire action if catalog registration fails
          }
        }

        // Set up webhook for future catalog updates (optional)
        await setupCatalogWebhook(octokit, owner, repo, config, logger);

        ctx.output('remoteUrl', remoteUrl);
        ctx.output('repoContentsUrl', repoContentsUrl);
        ctx.output('cloneUrl', cloneUrl);
        if (catalogEntityRef) {
          ctx.output('catalogEntityRef', catalogEntityRef);
        }

      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to create GitHub repository: ${error.message}`);
        }
        throw error;
      }
    },
  });
}

/**
 * Parse repository URL to extract owner and repo name
 */
function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  const url = new URL(repoUrl);
  const searchParams = new URLSearchParams(url.search);
  
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  
  if (!owner || !repo) {
    throw new Error(`Invalid repository URL format: ${repoUrl}. Expected format: github.com?owner=<owner>&repo=<repo>`);
  }
  
  return { owner, repo };
}

/**
 * Initialize repository with content from the workspace
 */
async function initializeRepositoryContent(
  ctx: any,
  octokit: Octokit,
  owner: string,
  repo: string,
  defaultBranch: string,
  gitConfig: {
    gitCommitMessage: string;
    gitAuthorName?: string;
    gitAuthorEmail?: string;
  }
) {
  const { gitCommitMessage, gitAuthorName, gitAuthorEmail } = gitConfig;

  // Get all files from the workspace
  const workspaceFiles = await ctx.workspacePath ? getWorkspaceFiles(ctx.workspacePath) : [];
  
  if (workspaceFiles.length === 0) {
    ctx.logger.warn('No files found in workspace to commit');
    return;
  }

  // Create blobs for all files
  const blobs: Array<{ path: string; sha: string; mode: string }> = [];
  
  for (const file of workspaceFiles) {
    const content = await file.content();
    const blobResponse = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64',
    });
    
    blobs.push({
      path: file.path,
      sha: blobResponse.data.sha,
      mode: '100644', // Regular file
    });
  }

  // Create tree
  const treeResponse = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: blobs.map(blob => ({
      path: blob.path,
      mode: blob.mode as any,
      type: 'blob' as const,
      sha: blob.sha,
    })),
  });

  // Create commit
  const commitResponse = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: gitCommitMessage,
    tree: treeResponse.data.sha,
    author: gitAuthorName && gitAuthorEmail ? {
      name: gitAuthorName,
      email: gitAuthorEmail,
    } : undefined,
  });

  // Update reference to point to the new commit
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${defaultBranch}`,
    sha: commitResponse.data.sha,
  });

  ctx.logger.info(`Initialized repository with ${blobs.length} files`);
}

/**
 * Get all files from workspace
 */
async function getWorkspaceFiles(workspacePath: string): Promise<Array<{ path: string; content: () => Promise<string> }>> {
  // This is a simplified implementation
  // In a real implementation, you would recursively read all files from the workspace
  const fs = require('fs').promises;
  const path = require('path');
  
  const files: Array<{ path: string; content: () => Promise<string> }> = [];
  
  async function readDirectory(dirPath: string, relativePath: string = '') {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeFilePath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        await readDirectory(fullPath, relativeFilePath);
      } else {
        files.push({
          path: relativeFilePath,
          content: async () => fs.readFile(fullPath, 'utf8'),
        });
      }
    }
  }
  
  await readDirectory(workspacePath);
  return files;
}

/**
 * Register service in the Backstage catalog
 */
async function registerServiceInCatalog(
  catalogApi: CatalogApi,
  repoContentsUrl: string,
  catalogInfoPath: string,
  logger: Logger
): Promise<string> {
  const catalogFileUrl = `${repoContentsUrl}${catalogInfoPath}`;
  
  try {
    // Register the entity in the catalog
    const registrationResult = await catalogApi.addLocation({
      type: 'url',
      target: catalogFileUrl,
    });

    if (registrationResult.entities && registrationResult.entities.length > 0) {
      const entityRef = registrationResult.entities[0].metadata.name;
      logger.info(`Successfully registered entity: ${entityRef}`);
      return entityRef;
    } 
      throw new Error('No entities were registered');
    
  } catch (error) {
    logger.error(`Failed to register service in catalog: ${error}`);
    throw error;
  }
}

/**
 * Set up webhook for automatic catalog updates
 */
async function setupCatalogWebhook(
  octokit: Octokit,
  owner: string,
  repo: string,
  config: Config,
  logger: Logger
): Promise<void> {
  try {
    const webhookUrl = config.getOptionalString('catalog.webhook.url');
    const webhookSecret = config.getOptionalString('catalog.webhook.secret');
    
    if (!webhookUrl) {
      logger.info('No webhook URL configured, skipping webhook setup');
      return;
    }

    await octokit.rest.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: webhookSecret,
      },
      events: ['push', 'pull_request'],
      active: true,
    });

    logger.info(`Webhook configured for automatic catalog updates: ${webhookUrl}`);
  } catch (error) {
    logger.warn(`Failed to set up webhook: ${error}`);
    // Don't fail the action if webhook setup fails
  }
}