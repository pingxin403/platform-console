/**
 * Incident data collector for DORA metrics
 * 
 * Collects incident data from various sources including:
 * - Jira (incident tickets)
 * - PagerDuty (incidents and alerts)
 * 
 * Used for calculating MTTR (Mean Time to Recovery)
 */

import { Logger } from 'winston';
import axios, { AxiosInstance } from 'axios';
import { IncidentData, DORACollectorConfig, CollectionResult } from './types';

export class IncidentCollector {
  private readonly logger: Logger;
  private readonly config: DORACollectorConfig['incidents'];
  private jiraClient?: AxiosInstance;
  private pagerdutyClient?: AxiosInstance;

  constructor(logger: Logger, config: DORACollectorConfig['incidents']) {
    this.logger = logger;
    this.config = config;
    
    // Initialize Jira client if enabled
    if (config.jira?.enabled) {
      this.jiraClient = axios.create({
        baseURL: config.jira.serverUrl,
        auth: {
          username: config.jira.username,
          password: config.jira.apiToken,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    }
    
    // Initialize PagerDuty client if enabled
    if (config.pagerduty?.enabled) {
      this.pagerdutyClient = axios.create({
        baseURL: 'https://api.pagerduty.com',
        headers: {
          'Authorization': `Token token=${config.pagerduty.token}`,
          'Accept': 'application/vnd.pagerduty+json;version=2',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    }
  }

  /**
   * Collect incident data from all configured sources
   */
  async collectIncidents(
    startDate: Date,
    endDate: Date,
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const incidents: IncidentData[] = [];

    try {
      this.logger.info('Starting incident data collection', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Collect from Jira if enabled
      if (this.config.jira?.enabled && this.jiraClient) {
        try {
          const jiraIncidents = await this.collectJiraIncidents(startDate, endDate);
          incidents.push(...jiraIncidents);
        } catch (error) {
          const errorMsg = `Failed to collect Jira incidents: ${error}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Collect from PagerDuty if enabled
      if (this.config.pagerduty?.enabled && this.pagerdutyClient) {
        try {
          const pdIncidents = await this.collectPagerDutyIncidents(startDate, endDate);
          incidents.push(...pdIncidents);
        } catch (error) {
          const errorMsg = `Failed to collect PagerDuty incidents: ${error}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const duration = Date.now() - startTime;
      
      this.logger.info('Incident data collection completed', {
        recordsCollected: incidents.length,
        duration,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        source: 'jira', // Primary source
        recordsCollected: incidents.length,
        errors,
        collectedAt: new Date(),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = `Incident collection failed: ${error}`;
      this.logger.error(errorMsg);
      
      return {
        success: false,
        source: 'jira',
        recordsCollected: 0,
        errors: [errorMsg],
        collectedAt: new Date(),
        duration,
      };
    }
  }

  /**
   * Collect incidents from Jira
   */
  private async collectJiraIncidents(
    startDate: Date,
    endDate: Date,
  ): Promise<IncidentData[]> {
    if (!this.jiraClient || !this.config.jira) {
      return [];
    }

    const incidents: IncidentData[] = [];
    
    try {
      const projectKeys = this.config.jira.projectKeys.join(',');
      
      // Build JQL query for incidents
      const jql = `project in (${projectKeys}) AND type = Incident AND created >= "${startDate.toISOString().split('T')[0]}" AND created <= "${endDate.toISOString().split('T')[0]}" ORDER BY created DESC`;
      
      let startAt = 0;
      const maxResults = 100;
      
      while (true) {
        const response = await this.jiraClient.get('/rest/api/2/search', {
          params: {
            jql,
            startAt,
            maxResults,
            fields: 'summary,created,resolutiondate,priority,status,customfield_*',
          },
        });

        const issues = response.data.issues || [];
        
        for (const issue of issues) {
          const incident = this.mapJiraIssueToIncident(issue);
          if (incident) {
            incidents.push(incident);
          }
        }

        if (issues.length < maxResults) {
          break;
        }

        startAt += maxResults;
      }
    } catch (error) {
      this.logger.error('Failed to collect Jira incidents', { error });
      throw error;
    }

    return incidents;
  }

  /**
   * Map Jira issue to incident data
   */
  private mapJiraIssueToIncident(issue: any): IncidentData | null {
    try {
      const fields = issue.fields;
      
      const incident: IncidentData = {
        serviceId: this.extractServiceIdFromJira(issue),
        serviceName: fields.project?.name || 'unknown',
        incidentId: issue.key,
        title: fields.summary,
        severity: this.mapJiraPriorityToSeverity(fields.priority?.name),
        createdAt: new Date(fields.created),
        resolvedAt: fields.resolutiondate ? new Date(fields.resolutiondate) : null,
        detectedAt: new Date(fields.created), // Assuming detection time = creation time
        acknowledgedAt: null, // Jira doesn't have explicit acknowledgment
        status: this.mapJiraStatus(fields.status?.name),
        rootCause: fields.customfield_rootcause || undefined,
      };

      return incident;
    } catch (error) {
      this.logger.warn(`Failed to map Jira issue ${issue.key}`, { error });
      return null;
    }
  }

  /**
   * Extract service ID from Jira issue
   */
  private extractServiceIdFromJira(issue: any): string {
    // Try to extract from custom fields or labels
    const fields = issue.fields;
    const labels = fields.labels || [];
    
    const serviceLabel = labels.find((l: string) => l.startsWith('service:'));
    if (serviceLabel) {
      return serviceLabel.replace('service:', '');
    }
    
    return fields.project?.key || 'unknown';
  }

  /**
   * Map Jira priority to severity
   */
  private mapJiraPriorityToSeverity(
    priority: string | undefined,
  ): 'critical' | 'high' | 'medium' | 'low' {
    const p = priority?.toLowerCase() || '';
    
    if (p.includes('critical') || p.includes('blocker')) {
      return 'critical';
    } else if (p.includes('high') || p.includes('major')) {
      return 'high';
    } else if (p.includes('medium') || p.includes('normal')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Map Jira status to incident status
   */
  private mapJiraStatus(
    status: string | undefined,
  ): 'open' | 'acknowledged' | 'resolved' | 'closed' {
    const s = status?.toLowerCase() || '';
    
    if (s.includes('closed') || s.includes('done')) {
      return 'closed';
    } else if (s.includes('resolved')) {
      return 'resolved';
    } else if (s.includes('progress') || s.includes('investigating')) {
      return 'acknowledged';
    } else {
      return 'open';
    }
  }

  /**
   * Collect incidents from PagerDuty
   */
  private async collectPagerDutyIncidents(
    startDate: Date,
    endDate: Date,
  ): Promise<IncidentData[]> {
    if (!this.pagerdutyClient || !this.config.pagerduty) {
      return [];
    }

    const incidents: IncidentData[] = [];
    
    try {
      const serviceIds = this.config.pagerduty.serviceIds;
      
      for (const serviceId of serviceIds) {
        let offset = 0;
        const limit = 100;
        
        while (true) {
          const response = await this.pagerdutyClient.get('/incidents', {
            params: {
              'service_ids[]': serviceId,
              since: startDate.toISOString(),
              until: endDate.toISOString(),
              offset,
              limit,
            },
          });

          const pdIncidents = response.data.incidents || [];
          
          for (const pdIncident of pdIncidents) {
            const incident = this.mapPagerDutyIncidentToIncident(pdIncident);
            if (incident) {
              incidents.push(incident);
            }
          }

          if (pdIncidents.length < limit) {
            break;
          }

          offset += limit;
        }
      }
    } catch (error) {
      this.logger.error('Failed to collect PagerDuty incidents', { error });
      throw error;
    }

    return incidents;
  }

  /**
   * Map PagerDuty incident to incident data
   */
  private mapPagerDutyIncidentToIncident(pdIncident: any): IncidentData | null {
    try {
      const incident: IncidentData = {
        serviceId: pdIncident.service?.id || 'unknown',
        serviceName: pdIncident.service?.summary || 'unknown',
        incidentId: pdIncident.id,
        title: pdIncident.title || pdIncident.summary,
        severity: this.mapPagerDutyUrgencyToSeverity(pdIncident.urgency),
        createdAt: new Date(pdIncident.created_at),
        resolvedAt: pdIncident.resolved_at ? new Date(pdIncident.resolved_at) : null,
        detectedAt: new Date(pdIncident.created_at),
        acknowledgedAt: pdIncident.acknowledged_at
          ? new Date(pdIncident.acknowledged_at)
          : null,
        status: this.mapPagerDutyStatus(pdIncident.status),
      };

      return incident;
    } catch (error) {
      this.logger.warn(`Failed to map PagerDuty incident ${pdIncident.id}`, {
        error,
      });
      return null;
    }
  }

  /**
   * Map PagerDuty urgency to severity
   */
  private mapPagerDutyUrgencyToSeverity(
    urgency: string | undefined,
  ): 'critical' | 'high' | 'medium' | 'low' {
    const u = urgency?.toLowerCase() || '';
    
    if (u === 'high') {
      return 'critical';
    } else if (u === 'low') {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Map PagerDuty status to incident status
   */
  private mapPagerDutyStatus(
    status: string | undefined,
  ): 'open' | 'acknowledged' | 'resolved' | 'closed' {
    const s = status?.toLowerCase() || '';
    
    if (s === 'resolved') {
      return 'resolved';
    } else if (s === 'acknowledged') {
      return 'acknowledged';
    } else if (s === 'triggered') {
      return 'open';
    } else {
      return 'closed';
    }
  }

  /**
   * Get incident data for storage
   */
  getIncidentData(): IncidentData[] {
    // This would be called after collectIncidents to get the collected data
    // For now, we'll implement this as part of the main collection flow
    return [];
  }
}
