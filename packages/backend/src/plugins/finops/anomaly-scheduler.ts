/**
 * Anomaly Detection Scheduler
 * 
 * Runs anomaly detection periodically (hourly by default)
 * Sends alerts for detected anomalies
 */

import { AnomalyDetector } from './anomaly-detector';
import { AlertEngine } from './alert-engine';
import { CostAnomaly } from './types';

export interface SchedulerConfig {
  intervalMinutes: number; // How often to run detection (default: 60 minutes)
  services: string[]; // List of service IDs to monitor
  enabled: boolean;
}

export class AnomalyScheduler {
  private config: SchedulerConfig;
  private detector: AnomalyDetector;
  private alertEngine: AlertEngine;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(
    config: SchedulerConfig,
    detector: AnomalyDetector,
    alertEngine: AlertEngine,
  ) {
    this.config = config;
    this.detector = detector;
    this.alertEngine = alertEngine;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('Anomaly detection scheduler is disabled');
      return;
    }

    if (this.isRunning) {
      console.warn('Scheduler is already running');
      return;
    }

    console.log(
      `Starting anomaly detection scheduler (interval: ${this.config.intervalMinutes} minutes)`,
    );

    // Run immediately on start
    this.runDetection();

    // Schedule periodic runs
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runDetection();
    }, intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('Anomaly detection scheduler stopped');
  }

  /**
   * Run anomaly detection for all configured services
   */
  private async runDetection(): Promise<void> {
    console.log(
      `Running anomaly detection for ${this.config.services.length} services`,
    );

    const startTime = Date.now();
    let totalAnomalies = 0;
    let totalAlerts = 0;

    for (const serviceId of this.config.services) {
      try {
        // Detect anomalies
        const anomalies = await this.detector.detectAnomalies(serviceId);

        if (anomalies.length > 0) {
          console.log(
            `Detected ${anomalies.length} anomalies for service ${serviceId}`,
          );
          totalAnomalies += anomalies.length;

          // Send alerts for each anomaly
          for (const anomaly of anomalies) {
            await this.sendAlertForAnomaly(anomaly, serviceId);
            totalAlerts++;
          }
        }
      } catch (error) {
        console.error(`Failed to detect anomalies for ${serviceId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `Anomaly detection completed in ${duration}ms. ` +
      `Detected: ${totalAnomalies} anomalies, Sent: ${totalAlerts} alerts`,
    );
  }

  /**
   * Send alert for an anomaly
   */
  private async sendAlertForAnomaly(
    anomaly: CostAnomaly,
    serviceId: string,
  ): Promise<void> {
    try {
      // Check if notification already sent
      if (anomaly.notificationSent) {
        return;
      }

      // Send alert
      const notification = await this.alertEngine.sendAlert(anomaly, serviceId);

      if (notification.success) {
        // Mark notification as sent
        await this.detector.markNotificationSent(anomaly.id);
        console.log(
          `Alert sent for anomaly ${anomaly.id} via ${notification.channels.join(', ')}`,
        );
      } else {
        console.error(
          `Failed to send alert for anomaly ${anomaly.id}: ${notification.error}`,
        );
      }
    } catch (error) {
      console.error(`Error sending alert for anomaly ${anomaly.id}:`, error);
    }
  }

  /**
   * Run detection manually (for testing)
   */
  async runManual(serviceId?: string): Promise<CostAnomaly[]> {
    const services = serviceId ? [serviceId] : this.config.services;
    const allAnomalies: CostAnomaly[] = [];

    for (const svcId of services) {
      const anomalies = await this.detector.detectAnomalies(svcId);
      allAnomalies.push(...anomalies);

      // Send alerts
      for (const anomaly of anomalies) {
        await this.sendAlertForAnomaly(anomaly, svcId);
      }
    }

    return allAnomalies;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    intervalMinutes: number;
    servicesCount: number;
    enabled: boolean;
  } {
    return {
      running: this.isRunning,
      intervalMinutes: this.config.intervalMinutes,
      servicesCount: this.config.services.length,
      enabled: this.config.enabled,
    };
  }

  /**
   * Update services list
   */
  updateServices(services: string[]): void {
    this.config.services = services;
    console.log(`Updated services list: ${services.length} services`);
  }

  /**
   * Add service to monitoring
   */
  addService(serviceId: string): void {
    if (!this.config.services.includes(serviceId)) {
      this.config.services.push(serviceId);
      console.log(`Added service ${serviceId} to monitoring`);
    }
  }

  /**
   * Remove service from monitoring
   */
  removeService(serviceId: string): void {
    const index = this.config.services.indexOf(serviceId);
    if (index > -1) {
      this.config.services.splice(index, 1);
      console.log(`Removed service ${serviceId} from monitoring`);
    }
  }
}
