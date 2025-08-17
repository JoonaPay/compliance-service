import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram, register } from 'prom-client';
import {
  httpRequestsCounter,
  httpRequestDuration,
  complianceOperationsCounter,
  kycVerificationsGauge,
  kybVerificationsGauge,
  complianceAlertsCounter,
  sanctionsScreeningsCounter,
  documentVerificationsCounter,
  complianceChecksCounter,
  riskScoreHistogram,
  documentQualityHistogram,
  reportsGeneratedCounter,
  reportsRecordCountHistogram,
  kafkaMessagesCounter,
  databaseConnectionsGauge,
  cacheHitRatioGauge,
  errorRateCounter,
  businessMetricsGauge,
  processingTimeHistogram,
  alertResolutionTimeHistogram,
  complianceViolationsCounter,
  manualReviewsGauge,
  externalApiCallsCounter,
  externalApiResponseTimeHistogram,
} from './metrics.definitions';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly enabled: boolean;

  // Metric instances
  private httpRequests: Counter<string>;
  private httpDuration: Histogram<string>;
  private complianceOps: Counter<string>;
  private kycGauge: Gauge<string>;
  private kybGauge: Gauge<string>;
  private alertsCounter: Counter<string>;
  private sanctionsCounter: Counter<string>;
  private documentCounter: Counter<string>;
  private checksCounter: Counter<string>;
  private riskHistogram: Histogram<string>;
  private docQualityHistogram: Histogram<string>;
  private reportsCounter: Counter<string>;
  private reportsHistogram: Histogram<string>;
  private kafkaCounter: Counter<string>;
  private dbGauge: Gauge<string>;
  private cacheGauge: Gauge<string>;
  private errorsCounter: Counter<string>;
  private businessGauge: Gauge<string>;
  private processingHistogram: Histogram<string>;
  private resolutionHistogram: Histogram<string>;
  private violationsCounter: Counter<string>;
  private reviewsGauge: Gauge<string>;
  private apiCallsCounter: Counter<string>;
  private apiResponseHistogram: Histogram<string>;

  constructor() {
    this.enabled = process.env.METRICS_ENABLED !== 'false';
    
    if (this.enabled) {
      this.initializeMetrics();
      this.logger.log('✅ Metrics service initialized');
    } else {
      this.logger.log('📊 Metrics disabled via configuration');
    }
  }

  private initializeMetrics() {
    // HTTP Metrics
    this.httpRequests = register.getSingleMetric('compliance_http_requests_total') as Counter<string> || 
      new Counter(httpRequestsCounter);
    this.httpDuration = register.getSingleMetric('compliance_http_request_duration_seconds') as Histogram<string> || 
      new Histogram(httpRequestDuration);

    // Compliance Operations
    this.complianceOps = register.getSingleMetric('compliance_operations_total') as Counter<string> || 
      new Counter(complianceOperationsCounter);

    // KYC/KYB Metrics
    this.kycGauge = register.getSingleMetric('compliance_kyc_verifications_by_status') as Gauge<string> || 
      new Gauge(kycVerificationsGauge);
    this.kybGauge = register.getSingleMetric('compliance_kyb_verifications_by_status') as Gauge<string> || 
      new Gauge(kybVerificationsGauge);

    // Alert Metrics
    this.alertsCounter = register.getSingleMetric('compliance_alerts_total') as Counter<string> || 
      new Counter(complianceAlertsCounter);

    // Sanctions & Document Verification
    this.sanctionsCounter = register.getSingleMetric('compliance_sanctions_screenings_total') as Counter<string> || 
      new Counter(sanctionsScreeningsCounter);
    this.documentCounter = register.getSingleMetric('compliance_document_verifications_total') as Counter<string> || 
      new Counter(documentVerificationsCounter);

    // Compliance Checks
    this.checksCounter = register.getSingleMetric('compliance_checks_total') as Counter<string> || 
      new Counter(complianceChecksCounter);

    // Risk & Quality Metrics
    this.riskHistogram = register.getSingleMetric('compliance_risk_scores') as Histogram<string> || 
      new Histogram(riskScoreHistogram);
    this.docQualityHistogram = register.getSingleMetric('compliance_document_quality_scores') as Histogram<string> || 
      new Histogram(documentQualityHistogram);

    // Reporting Metrics
    this.reportsCounter = register.getSingleMetric('compliance_reports_generated_total') as Counter<string> || 
      new Counter(reportsGeneratedCounter);
    this.reportsHistogram = register.getSingleMetric('compliance_reports_record_count') as Histogram<string> || 
      new Histogram(reportsRecordCountHistogram);

    // Infrastructure Metrics
    this.kafkaCounter = register.getSingleMetric('compliance_kafka_messages_total') as Counter<string> || 
      new Counter(kafkaMessagesCounter);
    this.dbGauge = register.getSingleMetric('compliance_database_connections_active') as Gauge<string> || 
      new Gauge(databaseConnectionsGauge);
    this.cacheGauge = register.getSingleMetric('compliance_cache_hit_ratio') as Gauge<string> || 
      new Gauge(cacheHitRatioGauge);

    // Error Tracking
    this.errorsCounter = register.getSingleMetric('compliance_errors_total') as Counter<string> || 
      new Counter(errorRateCounter);

    // Business Metrics
    this.businessGauge = register.getSingleMetric('compliance_business_metrics') as Gauge<string> || 
      new Gauge(businessMetricsGauge);

    // Processing Time Metrics
    this.processingHistogram = register.getSingleMetric('compliance_processing_time_seconds') as Histogram<string> || 
      new Histogram(processingTimeHistogram);
    this.resolutionHistogram = register.getSingleMetric('compliance_alert_resolution_time_seconds') as Histogram<string> || 
      new Histogram(alertResolutionTimeHistogram);

    // Violation & Review Metrics
    this.violationsCounter = register.getSingleMetric('compliance_violations_total') as Counter<string> || 
      new Counter(complianceViolationsCounter);
    this.reviewsGauge = register.getSingleMetric('compliance_manual_reviews_pending') as Gauge<string> || 
      new Gauge(manualReviewsGauge);

    // External API Metrics
    this.apiCallsCounter = register.getSingleMetric('compliance_external_api_calls_total') as Counter<string> || 
      new Counter(externalApiCallsCounter);
    this.apiResponseHistogram = register.getSingleMetric('compliance_external_api_response_time_seconds') as Histogram<string> || 
      new Histogram(externalApiResponseTimeHistogram);
  }

  // HTTP Metrics
  recordHttpRequest(method: string, path: string, status: string) {
    if (!this.enabled) return;
    this.httpRequests.inc({ method, path, status });
  }

  recordHttpDuration(method: string, path: string, status: string, duration: number) {
    if (!this.enabled) return;
    this.httpDuration.observe({ method, path, status }, duration);
  }

  // Compliance Operations
  recordComplianceOperation(operationType: string, status: string) {
    if (!this.enabled) return;
    this.complianceOps.inc({ operation_type: operationType, status });
  }

  // KYC/KYB Status Tracking
  updateKycVerificationStatus(status: string, count: number) {
    if (!this.enabled) return;
    this.kycGauge.set({ status }, count);
  }

  updateKybVerificationStatus(status: string, count: number) {
    if (!this.enabled) return;
    this.kybGauge.set({ status }, count);
  }

  incrementKycByStatus(status: string) {
    if (!this.enabled) return;
    this.kycGauge.inc({ status });
  }

  incrementKybByStatus(status: string) {
    if (!this.enabled) return;
    this.kybGauge.inc({ status });
  }

  updateKycStatusMetrics(oldStatus: string, newStatus: string) {
    if (!this.enabled) return;
    this.kycGauge.dec({ status: oldStatus });
    this.kycGauge.inc({ status: newStatus });
  }

  updateKybStatusMetrics(oldStatus: string, newStatus: string) {
    if (!this.enabled) return;
    this.kybGauge.dec({ status: oldStatus });
    this.kybGauge.inc({ status: newStatus });
  }

  // Alert Management
  recordComplianceAlert(alertType: string, severity: string) {
    if (!this.enabled) return;
    this.alertsCounter.inc({ alert_type: alertType, severity });
  }

  recordAlertResolutionTime(alertType: string, severity: string, resolutionTimeSeconds: number) {
    if (!this.enabled) return;
    this.resolutionHistogram.observe({ alert_type: alertType, severity }, resolutionTimeSeconds);
  }

  // Sanctions & Document Verification
  recordSanctionsScreening(entityType: string, matchFound: boolean) {
    if (!this.enabled) return;
    this.sanctionsCounter.inc({ entity_type: entityType, match_found: matchFound.toString() });
  }

  recordDocumentVerification(documentType: string, provider: string, status: string) {
    if (!this.enabled) return;
    this.documentCounter.inc({ document_type: documentType, provider, status });
  }

  recordDocumentQuality(documentType: string, qualityScore: number) {
    if (!this.enabled) return;
    this.docQualityHistogram.observe({ document_type: documentType }, qualityScore);
  }

  // Compliance Checks
  recordComplianceCheck(checkType: string, result: string) {
    if (!this.enabled) return;
    this.checksCounter.inc({ check_type: checkType, result });
  }

  // Risk Assessment
  recordRiskScore(entityType: string, riskScore: number) {
    if (!this.enabled) return;
    this.riskHistogram.observe({ entity_type: entityType }, riskScore);
  }

  // Processing Time
  recordProcessingTime(operationType: string, processingTimeSeconds: number) {
    if (!this.enabled) return;
    this.processingHistogram.observe({ operation_type: operationType }, processingTimeSeconds);
  }

  // Reporting
  recordReportGeneration(reportType: string, recordCount: number) {
    if (!this.enabled) return;
    this.reportsCounter.inc({ report_type: reportType, format: 'json' }); // Default format
    this.reportsHistogram.observe({ report_type: reportType }, recordCount);
  }

  // Infrastructure Metrics
  recordKafkaMessage(topic: string, status: string) {
    if (!this.enabled) return;
    this.kafkaCounter.inc({ topic, status });
  }

  updateDatabaseConnections(activeConnections: number) {
    if (!this.enabled) return;
    this.dbGauge.set(activeConnections);
  }

  updateCacheHitRatio(cacheType: string, ratio: number) {
    if (!this.enabled) return;
    this.cacheGauge.set({ cache_type: cacheType }, ratio);
  }

  // Error Tracking
  recordError(errorType: string, severity: string) {
    if (!this.enabled) return;
    this.errorsCounter.inc({ error_type: errorType, severity });
  }

  // Violations & Manual Reviews
  recordComplianceViolation(violationType: string, entityType: string) {
    if (!this.enabled) return;
    this.violationsCounter.inc({ violation_type: violationType, entity_type: entityType });
  }

  updateManualReviewsCount(reviewType: string, count: number) {
    if (!this.enabled) return;
    this.reviewsGauge.set({ review_type: reviewType }, count);
  }

  // External API Calls
  recordExternalApiCall(provider: string, serviceType: string, status: string) {
    if (!this.enabled) return;
    this.apiCallsCounter.inc({ provider, service_type: serviceType, status });
  }

  recordExternalApiResponseTime(provider: string, serviceType: string, responseTimeSeconds: number) {
    if (!this.enabled) return;
    this.apiResponseHistogram.observe({ provider, service_type: serviceType }, responseTimeSeconds);
  }

  // Business Metrics
  updateBusinessMetric(metricType: string, period: string, value: number) {
    if (!this.enabled) return;
    this.businessGauge.set({ metric_type: metricType, period }, value);
  }

  // Utility Methods
  startTimer(labels?: Record<string, string>) {
    return {
      end: (histogram: Histogram<string>) => {
        const endTimer = histogram.startTimer(labels);
        return endTimer;
      }
    };
  }

  // Health Check Metrics
  recordHealthCheck(service: string, status: 'healthy' | 'unhealthy') {
    if (!this.enabled) return;
    this.recordComplianceOperation(`health_check_${service}`, status === 'healthy' ? 'success' : 'failure');
  }

  // Performance Monitoring
  async measureAsyncOperation<T>(
    operationType: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = (Date.now() - startTime) / 1000;
      this.recordProcessingTime(operationType, duration);
      this.recordComplianceOperation(operationType, 'success');
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.recordProcessingTime(operationType, duration);
      this.recordComplianceOperation(operationType, 'failure');
      this.recordError(operationType, 'high');
      throw error;
    }
  }

  // Metrics Export
  getMetrics(): string {
    return register.metrics();
  }

  // Reset all metrics (useful for testing)
  resetMetrics() {
    register.resetMetrics();
    this.logger.log('🔄 All metrics have been reset');
  }
}