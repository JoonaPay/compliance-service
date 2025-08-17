import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '@shared/metrics/metrics.service';
import { KycVerificationRepository } from '../repositories/kyc-verification.repository';
import { KybVerificationRepository } from '../repositories/kyb-verification.repository';
import { ComplianceAlert } from './compliance-rules.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum ReportType {
  SUSPICIOUS_ACTIVITY_REPORT = 'suspicious_activity_report',
  CURRENCY_TRANSACTION_REPORT = 'currency_transaction_report',
  KYC_COMPLIANCE_REPORT = 'kyc_compliance_report',
  KYB_COMPLIANCE_REPORT = 'kyb_compliance_report',
  SANCTIONS_SCREENING_REPORT = 'sanctions_screening_report',
  REGULATORY_AUDIT_REPORT = 'regulatory_audit_report',
  MONTHLY_COMPLIANCE_SUMMARY = 'monthly_compliance_summary',
  QUARTERLY_RISK_ASSESSMENT = 'quarterly_risk_assessment',
}

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
  XML = 'xml',
}

export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export interface ReportRequest {
  type: ReportType;
  format: ReportFormat;
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  filters?: Record<string, any>;
  includeDetails?: boolean;
  requestedBy: string;
}

export interface ReportMetadata {
  id: string;
  type: ReportType;
  format: ReportFormat;
  period: ReportPeriod;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  generatedBy: string;
  recordCount: number;
  filePath: string;
  fileSize: number;
  status: 'generating' | 'completed' | 'failed';
}

export interface SuspiciousActivityReport {
  id: string;
  userId?: string;
  businessId?: string;
  reportType: 'individual' | 'business';
  suspiciousActivity: {
    type: string;
    description: string;
    amount?: number;
    currency?: string;
    transactionIds?: string[];
    patterns: string[];
  };
  entityDetails: {
    name: string;
    address?: string;
    identification?: string;
    dateOfBirth?: Date;
    nationality?: string;
  };
  reportingInstitution: {
    name: string;
    address: string;
    contactPerson: string;
    phoneNumber: string;
    email: string;
  };
  filingDate: Date;
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  attachments?: string[];
}

export interface ComplianceSummary {
  period: {
    startDate: Date;
    endDate: Date;
  };
  kycMetrics: {
    totalInitiated: number;
    totalCompleted: number;
    totalApproved: number;
    totalRejected: number;
    averageProcessingTime: number;
    approvalRate: number;
  };
  kybMetrics: {
    totalInitiated: number;
    totalCompleted: number;
    totalApproved: number;
    totalRejected: number;
    averageProcessingTime: number;
    approvalRate: number;
  };
  alertMetrics: {
    totalAlerts: number;
    highSeverityAlerts: number;
    resolvedAlerts: number;
    avgResolutionTime: number;
    falsePositiveRate: number;
  };
  transactionMetrics: {
    totalTransactions: number;
    highValueTransactions: number;
    blockedTransactions: number;
    flaggedTransactions: number;
  };
  sanctionsScreening: {
    totalScreenings: number;
    sanctionsMatches: number;
    pepMatches: number;
    falsePositives: number;
  };
  riskAssessment: {
    averageRiskScore: number;
    highRiskEntities: number;
    riskDistribution: Record<string, number>;
  };
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly enabled: boolean;
  private readonly exportPath: string;
  private readonly retentionDays: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly kycRepository: KycVerificationRepository,
    private readonly kybRepository: KybVerificationRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {
    this.enabled = this.configService.get<boolean>('reporting.enabled', true);
    this.exportPath = this.configService.get<string>('reporting.exportPath', './reports');
    this.retentionDays = this.configService.get<number>('reporting.retention', 2555); // 7 years
  }

  async generateReport(request: ReportRequest): Promise<ReportMetadata> {
    try {
      this.logger.log(`Generating ${request.type} report for period: ${request.period}`);

      if (!this.enabled) {
        throw new Error('Reporting is disabled');
      }

      const reportId = this.generateReportId();
      const { startDate, endDate } = this.calculateDateRange(request);

      let reportData: any;
      let recordCount = 0;

      switch (request.type) {
        case ReportType.SUSPICIOUS_ACTIVITY_REPORT:
          reportData = await this.generateSuspiciousActivityReport(startDate, endDate, request.filters);
          recordCount = reportData.length;
          break;

        case ReportType.KYC_COMPLIANCE_REPORT:
          reportData = await this.generateKycComplianceReport(startDate, endDate, request.filters);
          recordCount = reportData.verifications?.length || 0;
          break;

        case ReportType.KYB_COMPLIANCE_REPORT:
          reportData = await this.generateKybComplianceReport(startDate, endDate, request.filters);
          recordCount = reportData.verifications?.length || 0;
          break;

        case ReportType.MONTHLY_COMPLIANCE_SUMMARY:
          reportData = await this.generateComplianceSummary(startDate, endDate);
          recordCount = 1;
          break;

        case ReportType.SANCTIONS_SCREENING_REPORT:
          reportData = await this.generateSanctionsReport(startDate, endDate, request.filters);
          recordCount = reportData.screenings?.length || 0;
          break;

        default:
          throw new Error(`Unsupported report type: ${request.type}`);
      }

      // Export report to file
      const filePath = await this.exportReport(reportId, request.type, request.format, reportData);
      const fileStats = await fs.stat(filePath);

      const metadata: ReportMetadata = {
        id: reportId,
        type: request.type,
        format: request.format,
        period: request.period,
        startDate,
        endDate,
        generatedAt: new Date(),
        generatedBy: request.requestedBy,
        recordCount,
        filePath,
        fileSize: fileStats.size,
        status: 'completed',
      };

      this.eventEmitter.emit('report.generated', {
        reportId,
        type: request.type,
        recordCount,
        generatedBy: request.requestedBy,
      });

      this.metricsService.recordComplianceOperation('report_generated', 'success');
      this.metricsService.recordReportGeneration(request.type, recordCount);

      this.logger.log(`Report generated successfully: ${reportId}, records: ${recordCount}`);
      return metadata;

    } catch (error) {
      this.logger.error(`Failed to generate report: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('report_generated', 'failure');
      this.metricsService.recordError('report_generation', 'high');
      throw error;
    }
  }

  async generateSuspiciousActivityReport(startDate: Date, endDate: Date, filters?: Record<string, any>): Promise<SuspiciousActivityReport[]> {
    this.logger.log(`Generating SAR for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // This would typically query a database of suspicious activities
    // For now, returning mock data structure
    return [
      {
        id: this.generateReportId(),
        userId: 'user_123',
        reportType: 'individual',
        suspiciousActivity: {
          type: 'Unusual Transaction Pattern',
          description: 'Multiple high-value transactions in short time period',
          amount: 50000,
          currency: 'USD',
          transactionIds: ['txn_001', 'txn_002', 'txn_003'],
          patterns: ['rapid_succession', 'high_value', 'round_amounts'],
        },
        entityDetails: {
          name: 'John Doe',
          address: '123 Main St, City, State',
          identification: 'SSN: ***-**-1234',
          dateOfBirth: new Date('1980-01-01'),
          nationality: 'US',
        },
        reportingInstitution: {
          name: 'JoonaPay Financial Services',
          address: '456 Finance Ave, City, State',
          contactPerson: 'Compliance Officer',
          phoneNumber: '+1-555-0123',
          email: 'compliance@joonapay.com',
        },
        filingDate: new Date(),
        reportingPeriod: {
          startDate,
          endDate,
        },
      },
    ];
  }

  async generateKycComplianceReport(startDate: Date, endDate: Date, filters?: Record<string, any>): Promise<any> {
    this.logger.log(`Generating KYC compliance report for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const verifications = await this.kycRepository.findByDateRange(startDate, endDate);
    
    const summary = {
      totalVerifications: verifications.length,
      approvedCount: verifications.filter(v => v.status === 'approved').length,
      rejectedCount: verifications.filter(v => v.status === 'rejected').length,
      pendingCount: verifications.filter(v => v.status === 'pending').length,
      averageProcessingTime: this.calculateAverageProcessingTime(verifications),
    };

    return {
      period: { startDate, endDate },
      summary,
      verifications: filters?.includeDetails ? verifications.map(v => v.toJSON()) : undefined,
    };
  }

  async generateKybComplianceReport(startDate: Date, endDate: Date, filters?: Record<string, any>): Promise<any> {
    this.logger.log(`Generating KYB compliance report for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const verifications = await this.kybRepository.findByDateRange(startDate, endDate);
    
    const summary = {
      totalVerifications: verifications.length,
      approvedCount: verifications.filter(v => v.status === 'approved').length,
      rejectedCount: verifications.filter(v => v.status === 'rejected').length,
      pendingCount: verifications.filter(v => v.status === 'pending').length,
      averageProcessingTime: this.calculateAverageProcessingTime(verifications),
    };

    return {
      period: { startDate, endDate },
      summary,
      verifications: filters?.includeDetails ? verifications.map(v => v.toJSON()) : undefined,
    };
  }

  async generateComplianceSummary(startDate: Date, endDate: Date): Promise<ComplianceSummary> {
    this.logger.log(`Generating compliance summary for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const [kycVerifications, kybVerifications] = await Promise.all([
      this.kycRepository.findByDateRange(startDate, endDate),
      this.kybRepository.findByDateRange(startDate, endDate),
    ]);

    return {
      period: { startDate, endDate },
      kycMetrics: {
        totalInitiated: kycVerifications.length,
        totalCompleted: kycVerifications.filter(v => ['approved', 'rejected'].includes(v.status)).length,
        totalApproved: kycVerifications.filter(v => v.status === 'approved').length,
        totalRejected: kycVerifications.filter(v => v.status === 'rejected').length,
        averageProcessingTime: this.calculateAverageProcessingTime(kycVerifications),
        approvalRate: kycVerifications.length > 0 ? 
          kycVerifications.filter(v => v.status === 'approved').length / kycVerifications.length : 0,
      },
      kybMetrics: {
        totalInitiated: kybVerifications.length,
        totalCompleted: kybVerifications.filter(v => ['approved', 'rejected'].includes(v.status)).length,
        totalApproved: kybVerifications.filter(v => v.status === 'approved').length,
        totalRejected: kybVerifications.filter(v => v.status === 'rejected').length,
        averageProcessingTime: this.calculateAverageProcessingTime(kybVerifications),
        approvalRate: kybVerifications.length > 0 ? 
          kybVerifications.filter(v => v.status === 'approved').length / kybVerifications.length : 0,
      },
      alertMetrics: {
        totalAlerts: 0, // Would be fetched from alerts repository
        highSeverityAlerts: 0,
        resolvedAlerts: 0,
        avgResolutionTime: 0,
        falsePositiveRate: 0,
      },
      transactionMetrics: {
        totalTransactions: 0, // Would be fetched from transaction monitoring
        highValueTransactions: 0,
        blockedTransactions: 0,
        flaggedTransactions: 0,
      },
      sanctionsScreening: {
        totalScreenings: kycVerifications.length + kybVerifications.length,
        sanctionsMatches: [...kycVerifications, ...kybVerifications].filter(v => 
          v.riskAssessment?.sanctionsMatch).length,
        pepMatches: kycVerifications.filter(v => v.riskAssessment?.pepMatch).length,
        falsePositives: 0,
      },
      riskAssessment: {
        averageRiskScore: this.calculateAverageRiskScore([...kycVerifications, ...kybVerifications]),
        highRiskEntities: [...kycVerifications, ...kybVerifications].filter(v => 
          v.riskAssessment && v.riskAssessment.score < 0.5).length,
        riskDistribution: this.calculateRiskDistribution([...kycVerifications, ...kybVerifications]),
      },
    };
  }

  async generateSanctionsReport(startDate: Date, endDate: Date, filters?: Record<string, any>): Promise<any> {
    this.logger.log(`Generating sanctions screening report for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const [kycVerifications, kybVerifications] = await Promise.all([
      this.kycRepository.findByDateRange(startDate, endDate),
      this.kybRepository.findByDateRange(startDate, endDate),
    ]);

    const allVerifications = [...kycVerifications, ...kybVerifications];
    const sanctionsMatches = allVerifications.filter(v => v.riskAssessment?.sanctionsMatch);
    const pepMatches = kycVerifications.filter(v => v.riskAssessment?.pepMatch);

    return {
      period: { startDate, endDate },
      summary: {
        totalScreenings: allVerifications.length,
        sanctionsMatches: sanctionsMatches.length,
        pepMatches: pepMatches.length,
        matchRate: allVerifications.length > 0 ? 
          (sanctionsMatches.length + pepMatches.length) / allVerifications.length : 0,
      },
      screenings: filters?.includeDetails ? {
        sanctionsMatches: sanctionsMatches.map(v => ({
          id: v.id,
          type: 'userId' in v ? 'kyc' : 'kyb',
          entityId: 'userId' in v ? v.userId : v.businessId,
          matchDetails: v.riskAssessment,
          screenedAt: v.riskAssessment?.assessedAt,
        })),
        pepMatches: pepMatches.map(v => ({
          id: v.id,
          userId: v.userId,
          matchDetails: v.riskAssessment,
          screenedAt: v.riskAssessment?.assessedAt,
        })),
      } : undefined,
    };
  }

  private async exportReport(reportId: string, type: ReportType, format: ReportFormat, data: any): Promise<string> {
    await fs.mkdir(this.exportPath, { recursive: true });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${type}_${timestamp}_${reportId}.${format}`;
    const filePath = path.join(this.exportPath, filename);

    switch (format) {
      case ReportFormat.JSON:
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        break;

      case ReportFormat.CSV:
        const csvData = this.convertToCSV(data);
        await fs.writeFile(filePath, csvData);
        break;

      case ReportFormat.XML:
        const xmlData = this.convertToXML(data);
        await fs.writeFile(filePath, xmlData);
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return filePath;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in production, use a proper CSV library
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        });
        csvRows.push(values.join(','));
      }
      
      return csvRows.join('\n');
    }
    
    return JSON.stringify(data);
  }

  private convertToXML(data: any): string {
    // Simple XML conversion - in production, use a proper XML library
    const convertValue = (key: string, value: any): string => {
      if (value === null || value === undefined) {
        return `<${key}></${key}>`;
      }
      
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return `<${key}>${value.map((item, index) => convertValue(`item_${index}`, item)).join('')}</${key}>`;
        } else {
          const nested = Object.entries(value).map(([k, v]) => convertValue(k, v)).join('');
          return `<${key}>${nested}</${key}>`;
        }
      }
      
      return `<${key}>${value}</${key}>`;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n<report>${convertValue('data', data)}</report>`;
  }

  private calculateDateRange(request: ReportRequest): { startDate: Date; endDate: Date } {
    if (request.period === ReportPeriod.CUSTOM) {
      return {
        startDate: request.startDate!,
        endDate: request.endDate!,
      };
    }

    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (request.period) {
      case ReportPeriod.DAILY:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case ReportPeriod.WEEKLY:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case ReportPeriod.MONTHLY:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case ReportPeriod.QUARTERLY:
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case ReportPeriod.YEARLY:
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private calculateAverageProcessingTime(verifications: any[]): number {
    const completedVerifications = verifications.filter(v => 
      v.submittedAt && (v.approvedAt || v.updatedAt)
    );

    if (completedVerifications.length === 0) return 0;

    const totalTime = completedVerifications.reduce((sum, v) => {
      const endTime = v.approvedAt || v.updatedAt;
      const duration = endTime.getTime() - v.submittedAt.getTime();
      return sum + duration;
    }, 0);

    return Math.round(totalTime / completedVerifications.length / (1000 * 60 * 60)); // Hours
  }

  private calculateAverageRiskScore(verifications: any[]): number {
    const withRiskScores = verifications.filter(v => v.riskAssessment?.score !== undefined);
    
    if (withRiskScores.length === 0) return 0;
    
    const totalScore = withRiskScores.reduce((sum, v) => sum + v.riskAssessment.score, 0);
    return totalScore / withRiskScores.length;
  }

  private calculateRiskDistribution(verifications: any[]): Record<string, number> {
    const distribution = { low: 0, medium: 0, high: 0, unknown: 0 };
    
    verifications.forEach(v => {
      if (!v.riskAssessment?.score) {
        distribution.unknown++;
      } else if (v.riskAssessment.score >= 0.7) {
        distribution.low++;
      } else if (v.riskAssessment.score >= 0.4) {
        distribution.medium++;
      } else {
        distribution.high++;
      }
    });
    
    return distribution;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}