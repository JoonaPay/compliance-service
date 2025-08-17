import { makeCounterProvider, makeGaugeProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

export const httpRequestsCounter = makeCounterProvider({
  name: 'compliance_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

export const httpRequestDuration = makeHistogramProvider({
  name: 'compliance_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const complianceOperationsCounter = makeCounterProvider({
  name: 'compliance_operations_total',
  help: 'Total number of compliance operations',
  labelNames: ['operation_type', 'status'],
});

export const kycVerificationsGauge = makeGaugeProvider({
  name: 'compliance_kyc_verifications_by_status',
  help: 'Number of KYC verifications by status',
  labelNames: ['status'],
});

export const kybVerificationsGauge = makeGaugeProvider({
  name: 'compliance_kyb_verifications_by_status',
  help: 'Number of KYB verifications by status',
  labelNames: ['status'],
});

export const complianceAlertsCounter = makeCounterProvider({
  name: 'compliance_alerts_total',
  help: 'Total number of compliance alerts generated',
  labelNames: ['alert_type', 'severity'],
});

export const sanctionsScreeningsCounter = makeCounterProvider({
  name: 'compliance_sanctions_screenings_total',
  help: 'Total number of sanctions screenings performed',
  labelNames: ['entity_type', 'match_found'],
});

export const documentVerificationsCounter = makeCounterProvider({
  name: 'compliance_document_verifications_total',
  help: 'Total number of document verifications',
  labelNames: ['document_type', 'provider', 'status'],
});

export const complianceChecksCounter = makeCounterProvider({
  name: 'compliance_checks_total',
  help: 'Total number of compliance checks performed',
  labelNames: ['check_type', 'result'],
});

export const riskScoreHistogram = makeHistogramProvider({
  name: 'compliance_risk_scores',
  help: 'Distribution of compliance risk scores',
  labelNames: ['entity_type'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
});

export const documentQualityHistogram = makeHistogramProvider({
  name: 'compliance_document_quality_scores',
  help: 'Distribution of document quality scores',
  labelNames: ['document_type'],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
});

export const reportsGeneratedCounter = makeCounterProvider({
  name: 'compliance_reports_generated_total',
  help: 'Total number of compliance reports generated',
  labelNames: ['report_type', 'format'],
});

export const reportsRecordCountHistogram = makeHistogramProvider({
  name: 'compliance_reports_record_count',
  help: 'Number of records in generated reports',
  labelNames: ['report_type'],
  buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
});

export const kafkaMessagesCounter = makeCounterProvider({
  name: 'compliance_kafka_messages_total',
  help: 'Total number of Kafka messages processed',
  labelNames: ['topic', 'status'],
});

export const databaseConnectionsGauge = makeGaugeProvider({
  name: 'compliance_database_connections_active',
  help: 'Number of active database connections',
});

export const cacheHitRatioGauge = makeGaugeProvider({
  name: 'compliance_cache_hit_ratio',
  help: 'Cache hit ratio (0-1)',
  labelNames: ['cache_type'],
});

export const errorRateCounter = makeCounterProvider({
  name: 'compliance_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'severity'],
});

export const businessMetricsGauge = makeGaugeProvider({
  name: 'compliance_business_metrics',
  help: 'Business-specific compliance metrics',
  labelNames: ['metric_type', 'period'],
});

export const processingTimeHistogram = makeHistogramProvider({
  name: 'compliance_processing_time_seconds',
  help: 'Time taken to process compliance operations',
  labelNames: ['operation_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800], // Up to 30 minutes
});

export const alertResolutionTimeHistogram = makeHistogramProvider({
  name: 'compliance_alert_resolution_time_seconds',
  help: 'Time taken to resolve compliance alerts',
  labelNames: ['alert_type', 'severity'],
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400], // Up to 1 day
});

export const complianceViolationsCounter = makeCounterProvider({
  name: 'compliance_violations_total',
  help: 'Total number of compliance violations detected',
  labelNames: ['violation_type', 'entity_type'],
});

export const manualReviewsGauge = makeGaugeProvider({
  name: 'compliance_manual_reviews_pending',
  help: 'Number of pending manual reviews',
  labelNames: ['review_type'],
});

export const externalApiCallsCounter = makeCounterProvider({
  name: 'compliance_external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['provider', 'service_type', 'status'],
});

export const externalApiResponseTimeHistogram = makeHistogramProvider({
  name: 'compliance_external_api_response_time_seconds',
  help: 'Response time for external API calls',
  labelNames: ['provider', 'service_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});