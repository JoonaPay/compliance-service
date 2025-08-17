export const configuration = () => ({
  port: parseInt(process.env.PORT, 10) || 3002,
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'JoonaPay Compliance Service',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/JoonaPay_Compliance_db',
    type: 'postgres',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  },

  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'compliance-service',
    groupId: process.env.KAFKA_GROUP_ID || 'compliance-service-group',
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_MECHANISM ? {
      mechanism: process.env.KAFKA_SASL_MECHANISM as any,
      username: process.env.KAFKA_SASL_USERNAME,
      password: process.env.KAFKA_SASL_PASSWORD,
    } : undefined,
  },

  kyc: {
    enabled: process.env.KYC_ENABLED !== 'false',
    provider: process.env.KYC_PROVIDER || 'jumio',
    jumio: {
      apiUrl: process.env.JUMIO_API_URL || 'https://netverify.com/api',
      apiKey: process.env.JUMIO_API_KEY,
      apiSecret: process.env.JUMIO_API_SECRET,
      webhook: process.env.JUMIO_WEBHOOK_URL,
    },
    onfido: {
      apiUrl: process.env.ONFIDO_API_URL || 'https://api.onfido.com',
      apiKey: process.env.ONFIDO_API_KEY,
      webhook: process.env.ONFIDO_WEBHOOK_URL,
    },
  },

  kyb: {
    enabled: process.env.KYB_ENABLED !== 'false',
    provider: process.env.KYB_PROVIDER || 'passfort',
    passfort: {
      apiUrl: process.env.PASSFORT_API_URL || 'https://api.passfort.com',
      apiKey: process.env.PASSFORT_API_KEY,
      webhook: process.env.PASSFORT_WEBHOOK_URL,
    },
  },

  sanctions: {
    enabled: process.env.SANCTIONS_ENABLED !== 'false',
    provider: process.env.SANCTIONS_PROVIDER || 'worldcheck',
    worldcheck: {
      apiUrl: process.env.WORLDCHECK_API_URL,
      apiKey: process.env.WORLDCHECK_API_KEY,
    },
    complyAdvantage: {
      apiUrl: process.env.COMPLY_ADVANTAGE_API_URL || 'https://api.complyadvantage.com',
      apiKey: process.env.COMPLY_ADVANTAGE_API_KEY,
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 2,
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },

  swagger: {
    title: 'JoonaPay Compliance Service API',
    description: 'KYC/KYB verification and regulatory compliance management service',
    version: '1.0.0',
    tag: 'compliance',
  },

  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    prefix: 'compliance_service_',
  },

  rules: {
    autoApprovalThreshold: parseFloat(process.env.AUTO_APPROVAL_THRESHOLD) || 0.95,
    riskScoreThreshold: parseFloat(process.env.RISK_SCORE_THRESHOLD) || 0.7,
    manualReviewThreshold: parseFloat(process.env.MANUAL_REVIEW_THRESHOLD) || 0.5,
  },

  reporting: {
    enabled: process.env.REPORTING_ENABLED !== 'false',
    exportPath: process.env.REPORT_EXPORT_PATH || './reports',
    retention: parseInt(process.env.REPORT_RETENTION_DAYS, 10) || 2555, // 7 years
  },
});