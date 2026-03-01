/**
 * Permission Synchronization Service
 * 
 * Monitors and synchronizes user permissions from external sources (GitHub teams)
 * Ensures permissions are updated within 5 minutes of role changes
 */

import { Logger } from 'winston';
import { Config } from '@backstage/config';
import { Octokit } from '@octokit/rest';

interface UserPermissionSync {
  userId: string;
  teams: string[];
  role: string;
  lastSynced: Date;
}

export class PermissionSyncService {
  private logger: Logger;
  private config: Config;
  private octokit?: Octokit;
  private syncInterval: NodeJS.Timeout | null = null;
  private userPermissions: Map<string, UserPermissionSync> = new Map();
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize GitHub client if token is available
    const githubToken = config.getOptionalString('integrations.github.0.token');
    if (githubToken) {
      this.octokit = new Octokit({ auth: githubToken });
    } else {
      this.logger.warn('GitHub token not configured, permission sync will be limited');
    }
  }

  /**
   * Start the permission synchronization service
   */
  public start() {
    if (this.syncInterval) {
      this.logger.warn('Permission sync service already started');
      return;
    }

    this.logger.info('Starting permission synchronization service');
    
    // Run initial sync
    this.syncPermissions().catch(error => {
      this.logger.error('Error in initial permission sync', error);
    });

    // Schedule periodic syncs every 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncPermissions().catch(error => {
        this.logger.error('Error in scheduled permission sync', error);
      });
    }, this.SYNC_INTERVAL);

    this.logger.info(`Permission sync service started (interval: ${this.SYNC_INTERVAL / 1000}s)`);
  }

  /**
   * Stop the permission synchronization service
   */
  public stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info('Permission sync service stopped');
    }
  }

  /**
   * Synchronize permissions from external sources
   */
  private async syncPermissions() {
    const startTime = Date.now();
    this.logger.debug('Starting permission synchronization');

    try {
      // Sync GitHub team memberships
      if (this.octokit) {
        await this.syncGitHubTeams();
      }

      // Additional sync sources can be added here
      // e.g., LDAP, Active Directory, Keycloak, etc.

      const duration = Date.now() - startTime;
      this.logger.info(`Permission synchronization completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error during permission synchronization', error);
    }
  }

  /**
   * Sync GitHub team memberships
   */
  private async syncGitHubTeams() {
    if (!this.octokit) {
      return;
    }

    try {
      // Get organization from config
      const githubOrg = this.config.getOptionalString('organization.name');
      if (!githubOrg) {
        this.logger.warn('Organization name not configured, skipping GitHub team sync');
        return;
      }

      // Get all teams in the organization
      const { data: teams } = await this.octokit.teams.list({
        org: githubOrg,
        per_page: 100,
      });

      this.logger.debug(`Found ${teams.length} teams in organization ${githubOrg}`);

      // Sync each team's members
      for (const team of teams) {
        await this.syncTeamMembers(githubOrg, team.slug);
      }
    } catch (error) {
      this.logger.error('Error syncing GitHub teams', error);
    }
  }

  /**
   * Sync members of a specific GitHub team
   */
  private async syncTeamMembers(org: string, teamSlug: string) {
    if (!this.octokit) {
      return;
    }

    try {
      const { data: members } = await this.octokit.teams.listMembersInOrg({
        org,
        team_slug: teamSlug,
        per_page: 100,
      });

      this.logger.debug(`Team ${teamSlug} has ${members.length} members`);

      // Update user permissions for each member
      for (const member of members) {
        this.updateUserPermission(member.login, teamSlug);
      }
    } catch (error) {
      this.logger.error(`Error syncing team ${teamSlug}`, error);
    }
  }

  /**
   * Update user permission based on team membership
   */
  private updateUserPermission(username: string, teamSlug: string) {
    const userId = `user:default/${username}`;
    
    // Get or create user permission record
    let userPerm = this.userPermissions.get(userId);
    if (!userPerm) {
      userPerm = {
        userId,
        teams: [],
        role: 'viewer',
        lastSynced: new Date(),
      };
    }

    // Add team if not already present
    if (!userPerm.teams.includes(teamSlug)) {
      userPerm.teams.push(teamSlug);
      this.logger.debug(`Added team ${teamSlug} to user ${username}`);
    }

    // Determine role based on teams
    userPerm.role = this.determineRoleFromTeams(userPerm.teams);
    userPerm.lastSynced = new Date();

    // Update the map
    this.userPermissions.set(userId, userPerm);
  }

  /**
   * Determine user role based on team memberships
   */
  private determineRoleFromTeams(teams: string[]): string {
    const roleMapping = this.config.getOptional('permission.userRoles.github') as Record<string, string> || {};

    // Check each team against role mappings (highest priority first)
    const rolePriority = ['admin', 'engineering-lead', 'developer', 'contractor', 'viewer'];
    
    for (const role of rolePriority) {
      for (const [team, mappedRole] of Object.entries(roleMapping)) {
        if (mappedRole === role && teams.includes(team)) {
          return role;
        }
      }
    }

    return roleMapping['default'] || 'viewer';
  }

  /**
   * Get user permissions (for debugging/monitoring)
   */
  public getUserPermissions(userId: string): UserPermissionSync | undefined {
    return this.userPermissions.get(userId);
  }

  /**
   * Get all synced user permissions (for debugging/monitoring)
   */
  public getAllUserPermissions(): UserPermissionSync[] {
    return Array.from(this.userPermissions.values());
  }

  /**
   * Get sync statistics
   */
  public getSyncStats() {
    return {
      totalUsers: this.userPermissions.size,
      lastSyncTime: this.getLastSyncTime(),
      nextSyncIn: this.getNextSyncTime(),
    };
  }

  private getLastSyncTime(): Date | null {
    let lastSync: Date | null = null;
    for (const perm of this.userPermissions.values()) {
      if (!lastSync || perm.lastSynced > lastSync) {
        lastSync = perm.lastSynced;
      }
    }
    return lastSync;
  }

  private getNextSyncTime(): number {
    // Calculate time until next sync (in seconds)
    const lastSync = this.getLastSyncTime();
    if (!lastSync) {
      return 0;
    }
    const nextSync = lastSync.getTime() + this.SYNC_INTERVAL;
    const now = Date.now();
    return Math.max(0, Math.floor((nextSync - now) / 1000));
  }
}
