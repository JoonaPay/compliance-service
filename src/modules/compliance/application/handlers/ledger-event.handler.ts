import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ComplianceRulesService, TransactionMonitoringRequest } from '../domain/services/compliance-rules.service';
import { KafkaService } from '@shared/kafka/kafka.service';
import { MetricsService } from '@shared/metrics/metrics.service';

export interface LedgerAccountCreatedEvent {
  accountId: string;
  userId?: string;
  businessId?: string;
  accountType: string;
  currency: string;
  balance: number;
  createdFromIdentity?: boolean;
  timestamp: string;
}

export interface LedgerTransactionCompletedEvent {
  transactionId: string;
  userId?: string;
  businessId?: string;
  amount: number;
  currency: string;
  transactionType: string;
  sourceAccountId: string;
  destinationAccountId: string;
  description?: string;
  initiatedBy?: string;
  sourceCountry?: string;
  destinationCountry?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface LedgerTransactionFailedEvent {
  transactionId: string;
  userId?: string;
  businessId?: string;
  amount: number;
  currency: string;
  failureReason: string;
  timestamp: string;
}

export interface LedgerBalanceUpdatedEvent {
  accountId: string;
  userId?: string;
  businessId?: string;
  previousBalance: number;
  newBalance: number;
  currency: string;
  changeAmount: number;
  changeType: 'credit' | 'debit';
  timestamp: string;
}

@Injectable()
export class LedgerEventHandler {
  private readonly logger = new Logger(LedgerEventHandler.name);

  constructor(
    private readonly complianceRulesService: ComplianceRulesService,
    private readonly kafkaService: KafkaService,
    private readonly metricsService: MetricsService,
  ) {}

  @OnEvent('ledger.account.created')
  async handleAccountCreated(event: LedgerAccountCreatedEvent) {
    try {
      this.logger.log(`Processing account created event: ${event.accountId}`);

      // Log account creation for audit trail
      await this.kafkaService.publishComplianceEvent('account.compliance.created', {
        accountId: event.accountId,
        userId: event.userId,
        businessId: event.businessId,
        accountType: event.accountType,
        currency: event.currency,
        initialBalance: event.balance,
        source: event.createdFromIdentity ? 'identity_service' : 'direct',
      });

      // Check if account creation requires additional compliance checks
      if (this.isHighValueAccount(event.balance) || this.isHighRiskCurrency(event.currency)) {
        await this.kafkaService.publishComplianceAlert({
          type: 'high_value_account_created',
          userId: event.userId,
          businessId: event.businessId,
          severity: 'medium',
          description: 'High-value or high-risk currency account created',
          details: {
            accountId: event.accountId,
            balance: event.balance,
            currency: event.currency,
            accountType: event.accountType,
          },
        });
      }

      this.metricsService.recordComplianceOperation('account_created_processed', 'success');

    } catch (error) {
      this.logger.error(`❌ Failed to process account created event:`, error);
      this.metricsService.recordComplianceOperation('account_created_processed', 'failure');
      this.metricsService.recordError('account_creation_processing', 'medium');
    }
  }

  @OnEvent('ledger.transaction.completed')
  async handleTransactionCompleted(event: LedgerTransactionCompletedEvent) {
    try {
      this.logger.log(`Processing transaction completed event: ${event.transactionId}`);

      // Prepare transaction monitoring request
      const monitoringRequest: TransactionMonitoringRequest = {
        userId: event.userId!,
        businessId: event.businessId,
        amount: event.amount,
        currency: event.currency,
        transactionType: event.transactionType,
        sourceCountry: event.sourceCountry,
        destinationCountry: event.destinationCountry,
        description: event.description,
        metadata: {
          ...event.metadata,
          transactionId: event.transactionId,
          sourceAccountId: event.sourceAccountId,
          destinationAccountId: event.destinationAccountId,
          initiatedBy: event.initiatedBy,
          timestamp: event.timestamp,
        },
      };

      // Run compliance checks
      const complianceResult = await this.complianceRulesService.checkTransactionCompliance(monitoringRequest);

      // Handle compliance results
      if (!complianceResult.allowed) {
        this.logger.warn(`🚨 Transaction ${event.transactionId} flagged by compliance: ${complianceResult.action}`);
        
        // Publish compliance action required event
        await this.kafkaService.publishComplianceEvent('transaction.compliance.action_required', {
          transactionId: event.transactionId,
          userId: event.userId,
          businessId: event.businessId,
          action: complianceResult.action,
          riskScore: complianceResult.riskScore,
          triggeredRules: complianceResult.triggeredRules,
          alertCount: complianceResult.alerts.length,
        });

        // Publish alerts
        for (const alert of complianceResult.alerts) {
          await this.kafkaService.publishComplianceAlert({
            type: 'transaction_compliance_violation',
            userId: event.userId,
            businessId: event.businessId,
            severity: alert.severity,
            description: alert.description,
            details: {
              transactionId: event.transactionId,
              amount: event.amount,
              currency: event.currency,
              ruleId: alert.ruleId,
              ruleName: alert.ruleName,
              action: alert.action,
            },
          });
        }
      }

      // Check for suspicious patterns
      await this.checkSuspiciousPatterns(event);

      // Check velocity limits
      await this.checkVelocityLimits(event);

      // Check cross-border compliance
      if (event.sourceCountry && event.destinationCountry && event.sourceCountry !== event.destinationCountry) {
        await this.checkCrossBorderCompliance(event);
      }

      this.metricsService.recordComplianceOperation('transaction_completed_processed', 'success');
      this.metricsService.recordRiskScore('transaction', complianceResult.riskScore);

    } catch (error) {
      this.logger.error(`❌ Failed to process transaction completed event:`, error);
      this.metricsService.recordComplianceOperation('transaction_completed_processed', 'failure');
      this.metricsService.recordError('transaction_processing', 'high');
    }
  }

  @OnEvent('ledger.transaction.failed')
  async handleTransactionFailed(event: LedgerTransactionFailedEvent) {
    try {
      this.logger.log(`Processing transaction failed event: ${event.transactionId}`);

      // Check if failure reason indicates suspicious activity
      if (this.isSuspiciousFailure(event.failureReason)) {
        await this.kafkaService.publishComplianceAlert({
          type: 'suspicious_transaction_failure',
          userId: event.userId,
          businessId: event.businessId,
          severity: 'medium',
          description: 'Transaction failed for potentially suspicious reasons',
          details: {
            transactionId: event.transactionId,
            amount: event.amount,
            currency: event.currency,
            failureReason: event.failureReason,
          },
        });
      }

      this.metricsService.recordComplianceOperation('transaction_failed_processed', 'success');

    } catch (error) {
      this.logger.error(`❌ Failed to process transaction failed event:`, error);
      this.metricsService.recordComplianceOperation('transaction_failed_processed', 'failure');
      this.metricsService.recordError('transaction_failure_processing', 'low');
    }
  }

  @OnEvent('ledger.balance.updated')
  async handleBalanceUpdated(event: LedgerBalanceUpdatedEvent) {
    try {
      this.logger.log(`Processing balance updated event for account: ${event.accountId}`);

      // Check for large balance changes that might indicate suspicious activity
      const changePercentage = Math.abs(event.changeAmount) / Math.max(event.previousBalance, 1);
      
      if (changePercentage > 0.5 && Math.abs(event.changeAmount) > 10000) { // 50% change and > $10k
        await this.kafkaService.publishComplianceAlert({
          type: 'significant_balance_change',
          userId: event.userId,
          businessId: event.businessId,
          severity: 'medium',
          description: 'Significant balance change detected',
          details: {
            accountId: event.accountId,
            previousBalance: event.previousBalance,
            newBalance: event.newBalance,
            changeAmount: event.changeAmount,
            changePercentage: Math.round(changePercentage * 100),
            currency: event.currency,
          },
        });
      }

      // Check for negative balances (if applicable to business rules)
      if (event.newBalance < 0) {
        await this.kafkaService.publishComplianceAlert({
          type: 'negative_balance',
          userId: event.userId,
          businessId: event.businessId,
          severity: 'high',
          description: 'Account balance went negative',
          details: {
            accountId: event.accountId,
            newBalance: event.newBalance,
            currency: event.currency,
          },
        });
      }

      this.metricsService.recordComplianceOperation('balance_updated_processed', 'success');

    } catch (error) {
      this.logger.error(`❌ Failed to process balance updated event:`, error);
      this.metricsService.recordComplianceOperation('balance_updated_processed', 'failure');
      this.metricsService.recordError('balance_update_processing', 'low');
    }
  }

  private async checkSuspiciousPatterns(event: LedgerTransactionCompletedEvent) {
    // Check for round number amounts (potential structuring)
    if (this.isRoundAmount(event.amount) && event.amount < 10000) {
      await this.kafkaService.publishComplianceAlert({
        type: 'potential_structuring',
        userId: event.userId,
        businessId: event.businessId,
        severity: 'medium',
        description: 'Round amount transaction below reporting threshold',
        details: {
          transactionId: event.transactionId,
          amount: event.amount,
          currency: event.currency,
          pattern: 'round_amount_below_threshold',
        },
      });
    }

    // Check for unusual timing patterns
    const hour = new Date(event.timestamp).getHours();
    if (hour < 6 || hour > 22) { // Transactions outside business hours
      await this.kafkaService.publishComplianceAlert({
        type: 'unusual_timing',
        userId: event.userId,
        businessId: event.businessId,
        severity: 'low',
        description: 'Transaction outside normal business hours',
        details: {
          transactionId: event.transactionId,
          hour,
          timestamp: event.timestamp,
        },
      });
    }
  }

  private async checkVelocityLimits(event: LedgerTransactionCompletedEvent) {
    // This would typically check against stored transaction history
    // For now, implementing basic high-frequency detection
    if (event.amount > 50000) { // High-value transaction
      await this.kafkaService.publishComplianceAlert({
        type: 'high_value_transaction',
        userId: event.userId,
        businessId: event.businessId,
        severity: 'high',
        description: 'High-value transaction detected',
        details: {
          transactionId: event.transactionId,
          amount: event.amount,
          currency: event.currency,
          threshold: 50000,
        },
      });
    }
  }

  private async checkCrossBorderCompliance(event: LedgerTransactionCompletedEvent) {
    const highRiskCountries = [
      'Afghanistan', 'Iran', 'North Korea', 'Syria', 'Venezuela',
      'Myanmar', 'Belarus', 'Russia', 'China'
    ];

    const isHighRiskDestination = highRiskCountries.some(country =>
      event.destinationCountry?.toLowerCase().includes(country.toLowerCase())
    );

    const isHighRiskSource = highRiskCountries.some(country =>
      event.sourceCountry?.toLowerCase().includes(country.toLowerCase())
    );

    if (isHighRiskDestination || isHighRiskSource) {
      await this.kafkaService.publishComplianceAlert({
        type: 'high_risk_jurisdiction_transaction',
        userId: event.userId,
        businessId: event.businessId,
        severity: 'high',
        description: 'Cross-border transaction involving high-risk jurisdiction',
        details: {
          transactionId: event.transactionId,
          amount: event.amount,
          currency: event.currency,
          sourceCountry: event.sourceCountry,
          destinationCountry: event.destinationCountry,
          riskType: isHighRiskDestination ? 'destination' : 'source',
        },
      });
    }

    // Check for reporting thresholds
    if (event.amount >= 3000) { // FINCEN reporting threshold for international transfers
      await this.kafkaService.publishComplianceEvent('cross_border.reporting_required', {
        transactionId: event.transactionId,
        userId: event.userId,
        businessId: event.businessId,
        amount: event.amount,
        currency: event.currency,
        sourceCountry: event.sourceCountry,
        destinationCountry: event.destinationCountry,
        reportType: 'international_transfer',
        threshold: 3000,
      });
    }
  }

  private isHighValueAccount(balance: number): boolean {
    return balance >= 100000; // $100k threshold
  }

  private isHighRiskCurrency(currency: string): boolean {
    const highRiskCurrencies = ['BTC', 'ETH', 'XMR', 'ZEC']; // Cryptocurrencies
    return highRiskCurrencies.includes(currency.toUpperCase());
  }

  private isSuspiciousFailure(reason: string): boolean {
    const suspiciousReasons = [
      'sanctions_check_failed',
      'kyc_verification_failed',
      'high_risk_transaction',
      'compliance_block'
    ];
    
    return suspiciousReasons.some(suspiciousReason =>
      reason.toLowerCase().includes(suspiciousReason)
    );
  }

  private isRoundAmount(amount: number): boolean {
    // Check if amount is a round number (ends in multiple zeros)
    const amountStr = amount.toString();
    const decimalIndex = amountStr.indexOf('.');
    const integerPart = decimalIndex > -1 ? amountStr.substring(0, decimalIndex) : amountStr;
    
    // Consider round if ends with 2 or more zeros
    return /00$/.test(integerPart);
  }
}