import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '@shared/metrics/metrics.service';
import { KycVerification, KycStatus } from '../entities/kyc-verification.entity';
import { KybVerification, KybStatus } from '../entities/kyb-verification.entity';

export enum RuleType {
  TRANSACTION_MONITORING = 'transaction_monitoring',
  VELOCITY_LIMITS = 'velocity_limits',
  GEOGRAPHIC_RESTRICTIONS = 'geographic_restrictions',
  SANCTIONS_SCREENING = 'sanctions_screening',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  KYC_REQUIREMENTS = 'kyc_requirements',
  KYB_REQUIREMENTS = 'kyb_requirements',
}

export enum RuleAction {
  ALLOW = 'allow',
  BLOCK = 'block',
  MANUAL_REVIEW = 'manual_review',
  ENHANCED_MONITORING = 'enhanced_monitoring',
  REQUEST_ADDITIONAL_INFO = 'request_additional_info',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ComplianceRule {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  conditions: RuleCondition[];
  action: RuleAction;
  severity: AlertSeverity;
  active: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in' | 'regex';
  value: any;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

export interface TransactionMonitoringRequest {
  userId: string;
  businessId?: string;
  amount: number;
  currency: string;
  transactionType: string;
  sourceCountry?: string;
  destinationCountry?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ComplianceAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  type: RuleType;
  severity: AlertSeverity;
  userId?: string;
  businessId?: string;
  transactionId?: string;
  description: string;
  details: Record<string, any>;
  action: RuleAction;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ComplianceCheckResult {
  allowed: boolean;
  action: RuleAction;
  alerts: ComplianceAlert[];
  triggeredRules: string[];
  riskScore: number;
}

@Injectable()
export class ComplianceRulesService {
  private readonly logger = new Logger(ComplianceRulesService.name);
  private rules: Map<string, ComplianceRule> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {
    this.initializeDefaultRules();
  }

  async checkTransactionCompliance(request: TransactionMonitoringRequest): Promise<ComplianceCheckResult> {
    try {
      this.logger.log(`Checking transaction compliance for user: ${request.userId}, amount: ${request.amount} ${request.currency}`);

      const activeRules = this.getActiveRulesByType(RuleType.TRANSACTION_MONITORING);
      const triggeredRules: string[] = [];
      const alerts: ComplianceAlert[] = [];
      let finalAction = RuleAction.ALLOW;
      let riskScore = 0;

      for (const rule of activeRules) {
        const ruleResult = await this.evaluateRule(rule, {
          amount: request.amount,
          currency: request.currency,
          transactionType: request.transactionType,
          sourceCountry: request.sourceCountry,
          destinationCountry: request.destinationCountry,
          userId: request.userId,
          businessId: request.businessId,
        });

        if (ruleResult.triggered) {
          triggeredRules.push(rule.id);
          
          if (ruleResult.alert) {
            alerts.push(ruleResult.alert);
          }

          // Determine most restrictive action
          if (this.getActionPriority(rule.action) > this.getActionPriority(finalAction)) {
            finalAction = rule.action;
          }

          // Aggregate risk score
          riskScore += this.getSeverityScore(rule.severity);
        }
      }

      // Normalize risk score
      riskScore = Math.min(riskScore / 100, 1);

      const result: ComplianceCheckResult = {
        allowed: finalAction === RuleAction.ALLOW,
        action: finalAction,
        alerts,
        triggeredRules,
        riskScore,
      };

      // Emit events for monitoring
      if (alerts.length > 0) {
        this.eventEmitter.emit('compliance.alerts.created', {
          userId: request.userId,
          transactionId: request.metadata?.transactionId,
          alertCount: alerts.length,
          highestSeverity: this.getHighestSeverity(alerts),
          action: finalAction,
        });
      }

      this.metricsService.recordComplianceCheck('transaction', finalAction);
      this.metricsService.recordRiskScore('transaction', riskScore);

      this.logger.log(`Transaction compliance check completed: ${finalAction}, alerts: ${alerts.length}, risk: ${riskScore}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to check transaction compliance: ${error.message}`, error.stack);
      this.metricsService.recordError('compliance_check', 'high');
      
      // Return safe default
      return {
        allowed: false,
        action: RuleAction.MANUAL_REVIEW,
        alerts: [],
        triggeredRules: [],
        riskScore: 1,
      };
    }
  }

  async checkKycCompliance(kyc: KycVerification): Promise<ComplianceCheckResult> {
    try {
      this.logger.log(`Checking KYC compliance for verification: ${kyc.id}`);

      const activeRules = this.getActiveRulesByType(RuleType.KYC_REQUIREMENTS);
      const triggeredRules: string[] = [];
      const alerts: ComplianceAlert[] = [];
      let finalAction = RuleAction.ALLOW;
      let riskScore = 0;

      for (const rule of activeRules) {
        const ruleResult = await this.evaluateRule(rule, {
          kycStatus: kyc.status,
          kycLevel: kyc.level,
          documentCount: kyc.documents.length,
          hasAllRequiredDocs: kyc.hasAllRequiredDocuments(),
          riskScore: kyc.riskAssessment?.score,
          sanctionsMatch: kyc.riskAssessment?.sanctionsMatch,
          pepMatch: kyc.riskAssessment?.pepMatch,
          userId: kyc.userId,
        });

        if (ruleResult.triggered) {
          triggeredRules.push(rule.id);
          
          if (ruleResult.alert) {
            alerts.push(ruleResult.alert);
          }

          if (this.getActionPriority(rule.action) > this.getActionPriority(finalAction)) {
            finalAction = rule.action;
          }

          riskScore += this.getSeverityScore(rule.severity);
        }
      }

      riskScore = Math.min(riskScore / 100, 1);

      const result: ComplianceCheckResult = {
        allowed: finalAction === RuleAction.ALLOW,
        action: finalAction,
        alerts,
        triggeredRules,
        riskScore,
      };

      this.metricsService.recordComplianceCheck('kyc', finalAction);

      return result;

    } catch (error) {
      this.logger.error(`Failed to check KYC compliance: ${error.message}`, error.stack);
      this.metricsService.recordError('kyc_compliance_check', 'high');
      
      return {
        allowed: false,
        action: RuleAction.MANUAL_REVIEW,
        alerts: [],
        triggeredRules: [],
        riskScore: 1,
      };
    }
  }

  async checkKybCompliance(kyb: KybVerification): Promise<ComplianceCheckResult> {
    try {
      this.logger.log(`Checking KYB compliance for verification: ${kyb.id}`);

      const activeRules = this.getActiveRulesByType(RuleType.KYB_REQUIREMENTS);
      const triggeredRules: string[] = [];
      const alerts: ComplianceAlert[] = [];
      let finalAction = RuleAction.ALLOW;
      let riskScore = 0;

      for (const rule of activeRules) {
        const ruleResult = await this.evaluateRule(rule, {
          kybStatus: kyb.status,
          businessType: kyb.businessDetails.type,
          documentCount: kyb.documents.length,
          uboCount: kyb.ultimateBeneficialOwners.length,
          hasAllRequiredDocs: kyb.hasAllRequiredDocuments(),
          hasRequiredUbos: kyb.hasRequiredUBOs(),
          totalOwnership: kyb.getTotalOwnershipPercentage(),
          riskScore: kyb.riskAssessment?.score,
          sanctionsMatch: kyb.riskAssessment?.sanctionsMatch,
          jurisdictionRisk: kyb.riskAssessment?.jurisdictionRisk,
          businessId: kyb.businessId,
        });

        if (ruleResult.triggered) {
          triggeredRules.push(rule.id);
          
          if (ruleResult.alert) {
            alerts.push(ruleResult.alert);
          }

          if (this.getActionPriority(rule.action) > this.getActionPriority(finalAction)) {
            finalAction = rule.action;
          }

          riskScore += this.getSeverityScore(rule.severity);
        }
      }

      riskScore = Math.min(riskScore / 100, 1);

      const result: ComplianceCheckResult = {
        allowed: finalAction === RuleAction.ALLOW,
        action: finalAction,
        alerts,
        triggeredRules,
        riskScore,
      };

      this.metricsService.recordComplianceCheck('kyb', finalAction);

      return result;

    } catch (error) {
      this.logger.error(`Failed to check KYB compliance: ${error.message}`, error.stack);
      this.metricsService.recordError('kyb_compliance_check', 'high');
      
      return {
        allowed: false,
        action: RuleAction.MANUAL_REVIEW,
        alerts: [],
        triggeredRules: [],
        riskScore: 1,
      };
    }
  }

  private async evaluateRule(rule: ComplianceRule, context: Record<string, any>): Promise<{ triggered: boolean; alert?: ComplianceAlert }> {
    let triggered = true;

    // Evaluate all conditions (AND logic)
    for (const condition of rule.conditions) {
      const conditionMet = this.evaluateCondition(condition, context);
      if (!conditionMet) {
        triggered = false;
        break;
      }
    }

    if (triggered) {
      const alert: ComplianceAlert = {
        id: this.generateId(),
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        severity: rule.severity,
        userId: context.userId,
        businessId: context.businessId,
        transactionId: context.transactionId,
        description: this.generateAlertDescription(rule, context),
        details: context,
        action: rule.action,
        status: 'open',
        createdAt: new Date(),
      };

      return { triggered: true, alert };
    }

    return { triggered: false };
  }

  private evaluateCondition(condition: RuleCondition, context: Record<string, any>): boolean {
    const fieldValue = this.getNestedValue(context, condition.field);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'regex':
        return new RegExp(conditionValue).test(String(fieldValue));
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getActiveRulesByType(type: RuleType): ComplianceRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.active && rule.type === type)
      .sort((a, b) => b.priority - a.priority);
  }

  private getActionPriority(action: RuleAction): number {
    switch (action) {
      case RuleAction.BLOCK: return 4;
      case RuleAction.MANUAL_REVIEW: return 3;
      case RuleAction.ENHANCED_MONITORING: return 2;
      case RuleAction.REQUEST_ADDITIONAL_INFO: return 1;
      case RuleAction.ALLOW: return 0;
      default: return 0;
    }
  }

  private getSeverityScore(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 40;
      case AlertSeverity.HIGH: return 30;
      case AlertSeverity.MEDIUM: return 20;
      case AlertSeverity.LOW: return 10;
      default: return 10;
    }
  }

  private getHighestSeverity(alerts: ComplianceAlert[]): AlertSeverity {
    const severityOrder = [AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL];
    return alerts.reduce((highest, alert) => {
      return severityOrder.indexOf(alert.severity) > severityOrder.indexOf(highest) ? alert.severity : highest;
    }, AlertSeverity.LOW);
  }

  private generateAlertDescription(rule: ComplianceRule, context: Record<string, any>): string {
    return `${rule.name}: ${rule.description}. Context: ${JSON.stringify(context, null, 2)}`;
  }

  private initializeDefaultRules(): void {
    // High-value transaction monitoring
    this.rules.set('txn-high-value', {
      id: 'txn-high-value',
      name: 'High Value Transaction',
      type: RuleType.TRANSACTION_MONITORING,
      description: 'Transaction amount exceeds high-value threshold',
      conditions: [
        { field: 'amount', operator: 'greater_than', value: 10000, type: 'number' }
      ],
      action: RuleAction.ENHANCED_MONITORING,
      severity: AlertSeverity.MEDIUM,
      active: true,
      priority: 80,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Sanctions screening rule
    this.rules.set('sanctions-match', {
      id: 'sanctions-match',
      name: 'Sanctions List Match',
      type: RuleType.SANCTIONS_SCREENING,
      description: 'Entity matches sanctions list',
      conditions: [
        { field: 'sanctionsMatch', operator: 'equals', value: true, type: 'boolean' }
      ],
      action: RuleAction.BLOCK,
      severity: AlertSeverity.CRITICAL,
      active: true,
      priority: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // PEP screening rule
    this.rules.set('pep-match', {
      id: 'pep-match',
      name: 'PEP Match',
      type: RuleType.SANCTIONS_SCREENING,
      description: 'Entity matches PEP list',
      conditions: [
        { field: 'pepMatch', operator: 'equals', value: true, type: 'boolean' }
      ],
      action: RuleAction.MANUAL_REVIEW,
      severity: AlertSeverity.HIGH,
      active: true,
      priority: 90,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // KYC incomplete rule
    this.rules.set('kyc-incomplete', {
      id: 'kyc-incomplete',
      name: 'Incomplete KYC',
      type: RuleType.KYC_REQUIREMENTS,
      description: 'KYC verification is incomplete',
      conditions: [
        { field: 'hasAllRequiredDocs', operator: 'equals', value: false, type: 'boolean' }
      ],
      action: RuleAction.REQUEST_ADDITIONAL_INFO,
      severity: AlertSeverity.MEDIUM,
      active: true,
      priority: 70,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // KYB UBO rule
    this.rules.set('kyb-missing-ubo', {
      id: 'kyb-missing-ubo',
      name: 'Missing UBO Information',
      type: RuleType.KYB_REQUIREMENTS,
      description: 'Business verification missing required UBO information',
      conditions: [
        { field: 'hasRequiredUbos', operator: 'equals', value: false, type: 'boolean' }
      ],
      action: RuleAction.REQUEST_ADDITIONAL_INFO,
      severity: AlertSeverity.HIGH,
      active: true,
      priority: 85,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Initialized ${this.rules.size} default compliance rules`);
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}