import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HttpModule } from '@nestjs/axios';
import { Repositories } from "@modules/compliance/infrastructure/repositories";
import { Queries } from "@modules/compliance/application/queries";
import { Mappers } from "@modules/compliance/infrastructure/mappers";
import { UseCases } from "@modules/compliance/application/domain/usecases";
import { Controllers } from "@modules/compliance/application/controllers";
import { CommandHandlers } from "@modules/compliance/application/commands";
import { OrmEntities } from "@modules/compliance/infrastructure/orm-entities";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Services } from "@modules/compliance/application/domain/services";

// Domain Entities
import { KycVerification } from './application/domain/entities/kyc-verification.entity';
import { KybVerification } from './application/domain/entities/kyb-verification.entity';

// Repositories
import { KycVerificationRepository } from './application/domain/repositories/kyc-verification.repository';
import { KybVerificationRepository } from './application/domain/repositories/kyb-verification.repository';

// Domain Services
import { KycService } from './application/domain/services/kyc.service';
import { KybService } from './application/domain/services/kyb.service';
import { ComplianceRulesService } from './application/domain/services/compliance-rules.service';
import { ReportingService } from './application/domain/services/reporting.service';

// External Services
import { JumioService } from './infrastructure/external/jumio.service';
import { OnfidoService } from './infrastructure/external/onfido.service';
import { WorldCheckService } from './infrastructure/external/worldcheck.service';
import { ComplyAdvantageService } from './infrastructure/external/comply-advantage.service';

// Event Handlers
import { IdentityEventHandler } from './application/handlers/identity-event.handler';
import { LedgerEventHandler } from './application/handlers/ledger-event.handler';

// Shared Services
import { KafkaService } from '../../shared/kafka/kafka.service';
import { MetricsService } from '../../shared/metrics/metrics.service';

// Metrics Definitions
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
} from '../../shared/metrics/metrics.definitions';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...OrmEntities,
      KycVerification,
      KybVerification,
    ]),
    CqrsModule,
    ConfigModule,
    EventEmitterModule,
    HttpModule,
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'compliance_',
        },
      },
      defaultLabels: {
        service: 'compliance-service',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
    }),
  ],
  providers: [
    ...CommandHandlers,
    ...Queries,
    ...Repositories,
    ...Mappers,
    ...UseCases,
    ...Services,

    // Shared Services
    KafkaService,
    MetricsService,

    // Repositories
    KycVerificationRepository,
    KybVerificationRepository,

    // Domain Services
    KycService,
    KybService,
    ComplianceRulesService,
    ReportingService,

    // External Services
    JumioService,
    OnfidoService,
    WorldCheckService,
    ComplyAdvantageService,

    // Event Handlers
    IdentityEventHandler,
    LedgerEventHandler,

    // Metrics Providers
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
  ],
  controllers: [...Controllers],
  exports: [
    // Export key services for use in other modules
    KycService,
    KybService,
    ComplianceRulesService,
    ReportingService,
    KafkaService,
    MetricsService,
  ],
})
export class complianceModule {}