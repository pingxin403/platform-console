/**
 * Alert Engine
 * 
 * Sends notifications for cost anomalies via Slack and Email
 */

import {
  CostAnomaly,
  AlertConfig,
  AlertNotification,
} from './types';

export class AlertEngine {
  private config: AlertConfig;

  constructor(config: AlertConfig) {
    this.config = config;
  }

  /**
   * Send alert notification for an anomaly
   */
  async sendAlert(
    anomaly: CostAnomaly,
    serviceName: string,
  ): Promise<AlertNotification> {
    const channels: ('slack' | 'email')[] = [];
    const errors: string[] = [];

    // Send Slack notification
    if (this.config.slack?.enabled) {
      try {
        await this.sendSlackNotification(anomaly, serviceName);
        channels.push('slack');
      } catch (error) {
        errors.push(`Slack: ${error}`);
      }
    }

    // Send Email notification
    if (this.config.email?.enabled) {
      try {
        await this.sendEmailNotification(anomaly, serviceName);
        channels.push('email');
      } catch (error) {
        errors.push(`Email: ${error}`);
      }
    }

    return {
      anomaly,
      serviceName,
      timestamp: new Date(),
      channels,
      success: channels.length > 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    anomaly: CostAnomaly,
    serviceName: string,
  ): Promise<void> {
    if (!this.config.slack?.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const message = this.formatSlackMessage(anomaly, serviceName);

    const response = await fetch(this.config.slack.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Format Slack message
   */
  private formatSlackMessage(
    anomaly: CostAnomaly,
    serviceName: string,
  ): any {
    const severityEmoji = {
      high: ':rotating_light:',
      medium: ':warning:',
      low: ':information_source:',
    };

    const anomalyTypeLabel = {
      spike: 'Cost Spike',
      sustained_increase: 'Sustained Cost Increase',
      unusual_pattern: 'Unusual Cost Pattern',
    };

    const color = {
      high: '#FF0000',
      medium: '#FFA500',
      low: '#FFFF00',
    };

    return {
      channel: this.config.slack?.channel,
      username: 'FinOps Alert',
      icon_emoji: ':moneybag:',
      attachments: [
        {
          color: color[anomaly.severity],
          title: `${severityEmoji[anomaly.severity]} ${anomalyTypeLabel[anomaly.anomalyType]} Detected`,
          fields: [
            {
              title: 'Service',
              value: serviceName,
              short: true,
            },
            {
              title: 'Severity',
              value: anomaly.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Current Cost',
              value: `$${anomaly.currentCost.toFixed(2)}`,
              short: true,
            },
            {
              title: 'Expected Cost',
              value: `$${anomaly.expectedCost.toFixed(2)}`,
              short: true,
            },
            {
              title: 'Deviation',
              value: `${anomaly.deviation.toFixed(1)}%`,
              short: true,
            },
            {
              title: 'Detected At',
              value: anomaly.detectedAt.toISOString(),
              short: true,
            },
          ],
          text: this.formatRecommendations(anomaly.recommendations),
          footer: 'FinOps Cost Monitoring',
          ts: Math.floor(anomaly.detectedAt.getTime() / 1000),
        },
      ],
    };
  }

  /**
   * Send Email notification
   */
  private async sendEmailNotification(
    anomaly: CostAnomaly,
    serviceName: string,
  ): Promise<void> {
    if (!this.config.email) {
      throw new Error('Email configuration not provided');
    }

    // In production, this would use nodemailer or similar
    // For MVP, we log the email content
    const emailContent = this.formatEmailMessage(anomaly, serviceName);
    
    console.log('Email notification (would be sent in production):');
    console.log('To:', this.config.email.to.join(', '));
    console.log('Subject:', emailContent.subject);
    console.log('Body:', emailContent.body);

    // Simulate email sending
    // In production: await this.sendEmail(emailContent);
  }

  /**
   * Format Email message
   */
  private formatEmailMessage(
    anomaly: CostAnomaly,
    serviceName: string,
  ): { subject: string; body: string } {
    const anomalyTypeLabel = {
      spike: 'Cost Spike',
      sustained_increase: 'Sustained Cost Increase',
      unusual_pattern: 'Unusual Cost Pattern',
    };

    const subject = `[${anomaly.severity.toUpperCase()}] ${anomalyTypeLabel[anomaly.anomalyType]} - ${serviceName}`;

    const body = `
Cost Anomaly Detected

Service: ${serviceName}
Anomaly Type: ${anomalyTypeLabel[anomaly.anomalyType]}
Severity: ${anomaly.severity.toUpperCase()}

Cost Details:
- Current Cost: $${anomaly.currentCost.toFixed(2)}
- Expected Cost: $${anomaly.expectedCost.toFixed(2)}
- Deviation: ${anomaly.deviation.toFixed(1)}%

Detected At: ${anomaly.detectedAt.toISOString()}

Recommended Actions:
${anomaly.recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}

---
This is an automated alert from the FinOps Cost Monitoring system.
Please review the cost anomaly and take appropriate action.
    `.trim();

    return { subject, body };
  }

  /**
   * Format recommendations for Slack
   */
  private formatRecommendations(recommendations: string[]): string {
    return (
      '*Recommended Actions:*\n' +
      recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')
    );
  }

  /**
   * Test alert configuration
   */
  async testAlert(): Promise<{ slack: boolean; email: boolean }> {
    const results = {
      slack: false,
      email: false,
    };

    // Test Slack
    if (this.config.slack?.enabled) {
      try {
        const testAnomaly: CostAnomaly = {
          id: 'test',
          serviceId: 'test-service',
          detectedAt: new Date(),
          anomalyType: 'spike',
          severity: 'low',
          currentCost: 100,
          expectedCost: 50,
          deviation: 100,
          recommendations: ['This is a test alert'],
          notificationSent: false,
        };
        await this.sendSlackNotification(testAnomaly, 'Test Service');
        results.slack = true;
      } catch (error) {
        console.error('Slack test failed:', error);
      }
    }

    // Test Email
    if (this.config.email?.enabled) {
      try {
        const testAnomaly: CostAnomaly = {
          id: 'test',
          serviceId: 'test-service',
          detectedAt: new Date(),
          anomalyType: 'spike',
          severity: 'low',
          currentCost: 100,
          expectedCost: 50,
          deviation: 100,
          recommendations: ['This is a test alert'],
          notificationSent: false,
        };
        await this.sendEmailNotification(testAnomaly, 'Test Service');
        results.email = true;
      } catch (error) {
        console.error('Email test failed:', error);
      }
    }

    return results;
  }
}
