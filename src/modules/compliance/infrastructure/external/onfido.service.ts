import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MetricsService } from '@shared/metrics/metrics.service';

export interface OnfidoVerificationRequest {
  userId: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentData: Buffer;
  documentFilename: string;
  metadata?: Record<string, any>;
}

export interface OnfidoVerificationResponse {
  verificationId: string;
  applicantId: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  extractedData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    expiryDate?: string;
    nationality?: string;
    address?: string;
  };
  verificationScore: number;
  checkResults?: {
    documentAuthenticity: boolean;
    documentIntegrity: boolean;
    visualAuthenticity: boolean;
    dataComparison: boolean;
    imageQuality: number;
  };
  rejectionReasons?: string[];
}

@Injectable()
export class OnfidoService {
  private readonly logger = new Logger(OnfidoService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {
    this.apiUrl = this.configService.get<string>('external.onfido.apiUrl', 'https://api.onfido.com/v3.6');
    this.apiToken = this.configService.get<string>('external.onfido.apiToken', '');
    this.enabled = this.configService.get<boolean>('external.onfido.enabled', false);
  }

  async verifyDocument(request: OnfidoVerificationRequest): Promise<OnfidoVerificationResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        this.logger.warn('Onfido service is disabled, returning mock response');
        return this.getMockResponse(request);
      }

      this.logger.log(`Initiating Onfido verification for user: ${request.userId}`);

      // Step 1: Create applicant
      const applicant = await this.createApplicant({
        first_name: request.firstName,
        last_name: request.lastName,
        email: `${request.userId}@temp.joonapay.com`,
      });

      // Step 2: Upload document
      const document = await this.uploadDocument(applicant.id, {
        type: this.mapDocumentType(request.documentType),
        file: request.documentData,
        filename: request.documentFilename,
      });

      // Step 3: Create check
      const check = await this.createCheck(applicant.id, document.id);

      // Step 4: Get check result
      const checkResult = await this.getCheckResult(check.id);

      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('onfido', 'document_verification', 'success');
      this.metricsService.recordExternalApiResponseTime('onfido', 'document_verification', responseTime);

      this.logger.log(`✅ Onfido verification completed for user: ${request.userId}`);
      
      return {
        verificationId: check.id,
        applicantId: applicant.id,
        status: this.mapOnfidoStatus(checkResult.status),
        extractedData: this.extractDocumentData(checkResult),
        verificationScore: this.calculateVerificationScore(checkResult),
        checkResults: this.mapCheckResults(checkResult),
        rejectionReasons: this.extractRejectionReasons(checkResult),
      };

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('onfido', 'document_verification', 'failure');
      this.metricsService.recordExternalApiResponseTime('onfido', 'document_verification', responseTime);
      
      this.logger.error(`❌ Onfido verification failed for user ${request.userId}:`, error);
      
      return {
        verificationId: `failed_${Date.now()}`,
        applicantId: '',
        status: 'failed',
        rejectionReasons: ['Service temporarily unavailable'],
        verificationScore: 0,
      };
    }
  }

  async createApplicant(applicantData: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/applicants`,
          applicantData,
          {
            headers: {
              'Authorization': `Token token=${this.apiToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Onfido applicant:', error);
      throw error;
    }
  }

  async uploadDocument(applicantId: string, documentData: any): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('type', documentData.type);
      formData.append('file', new Blob([documentData.file]), documentData.filename);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/documents`,
          formData,
          {
            headers: {
              'Authorization': `Token token=${this.apiToken}`,
            },
            params: {
              applicant_id: applicantId,
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to upload document to Onfido:', error);
      throw error;
    }
  }

  async createCheck(applicantId: string, documentId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/checks`,
          {
            applicant_id: applicantId,
            report_names: ['document', 'identity_enhanced'],
            document_ids: [documentId],
            suppress_form_emails: true,
          },
          {
            headers: {
              'Authorization': `Token token=${this.apiToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to create Onfido check:', error);
      throw error;
    }
  }

  async getCheckResult(checkId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/checks/${checkId}`,
          {
            headers: {
              'Authorization': `Token token=${this.apiToken}`,
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get Onfido check result:', error);
      throw error;
    }
  }

  async performFacialSimilarityCheck(applicantId: string, faceImageData: Buffer): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        return true; // Mock success
      }

      this.logger.log(`Performing facial similarity check for applicant: ${applicantId}`);

      const formData = new FormData();
      formData.append('file', new Blob([faceImageData]), 'face.jpg');

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/live_photos`,
          formData,
          {
            headers: {
              'Authorization': `Token token=${this.apiToken}`,
            },
            params: {
              applicant_id: applicantId,
            },
          },
        ),
      );

      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('onfido', 'facial_similarity', 'success');
      this.metricsService.recordExternalApiResponseTime('onfido', 'facial_similarity', responseTime);

      return response.data.quality === 'validate';

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('onfido', 'facial_similarity', 'failure');
      this.metricsService.recordExternalApiResponseTime('onfido', 'facial_similarity', responseTime);
      
      this.logger.error(`Facial similarity check failed for applicant ${applicantId}:`, error);
      return false;
    }
  }

  private mapDocumentType(documentType: string): string {
    const mapping: Record<string, string> = {
      'passport': 'passport',
      'driver_license': 'driving_licence',
      'national_id': 'national_identity_card',
      'utility_bill': 'utility_bill',
      'bank_statement': 'bank_building_society_statement',
    };

    return mapping[documentType] || 'passport';
  }

  private mapOnfidoStatus(status: string): 'pending' | 'approved' | 'rejected' | 'failed' {
    switch (status?.toLowerCase()) {
      case 'complete':
        return 'approved';
      case 'clear':
        return 'approved';
      case 'consider':
      case 'unidentified':
        return 'rejected';
      case 'in_progress':
      case 'awaiting_applicant':
        return 'pending';
      default:
        return 'failed';
    }
  }

  private extractDocumentData(checkResult: any): any {
    const reports = checkResult.reports || [];
    const documentReport = reports.find((r: any) => r.name === 'document');
    
    if (!documentReport?.properties) {
      return undefined;
    }

    return {
      firstName: documentReport.properties.first_name,
      lastName: documentReport.properties.last_name,
      dateOfBirth: documentReport.properties.date_of_birth,
      documentNumber: documentReport.properties.document_number,
      expiryDate: documentReport.properties.expiry_date,
      nationality: documentReport.properties.nationality,
      address: documentReport.properties.address?.formatted_address,
    };
  }

  private calculateVerificationScore(checkResult: any): number {
    if (checkResult.result === 'clear') return 0.95;
    if (checkResult.result === 'consider') return 0.7;
    return 0.3;
  }

  private mapCheckResults(checkResult: any): any {
    const reports = checkResult.reports || [];
    const documentReport = reports.find((r: any) => r.name === 'document');
    
    if (!documentReport?.breakdown) {
      return undefined;
    }

    return {
      documentAuthenticity: documentReport.breakdown.authenticity?.result === 'clear',
      documentIntegrity: documentReport.breakdown.image_integrity?.result === 'clear',
      visualAuthenticity: documentReport.breakdown.visual_authenticity?.result === 'clear',
      dataComparison: documentReport.breakdown.data_comparison?.result === 'clear',
      imageQuality: this.calculateImageQuality(documentReport.breakdown),
    };
  }

  private calculateImageQuality(breakdown: any): number {
    if (!breakdown) return 0;
    
    let qualityScore = 0;
    let checks = 0;

    ['image_integrity', 'visual_authenticity', 'colour_picture'].forEach(check => {
      if (breakdown[check]) {
        checks++;
        if (breakdown[check].result === 'clear') qualityScore++;
      }
    });

    return checks > 0 ? qualityScore / checks : 0;
  }

  private extractRejectionReasons(checkResult: any): string[] {
    const reasons: string[] = [];
    const reports = checkResult.reports || [];
    
    reports.forEach((report: any) => {
      if (report.result !== 'clear' && report.sub_result) {
        reasons.push(report.sub_result);
      }
    });

    return reasons;
  }

  private getMockResponse(request: OnfidoVerificationRequest): OnfidoVerificationResponse {
    const mockSuccess = Math.random() > 0.15; // 85% success rate for testing
    
    return {
      verificationId: `mock_onfido_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      applicantId: `mock_applicant_${request.userId}`,
      status: mockSuccess ? 'approved' : 'rejected',
      extractedData: mockSuccess ? {
        firstName: request.firstName,
        lastName: request.lastName,
        dateOfBirth: '1990-01-01',
        documentNumber: 'ONF123456789',
        expiryDate: '2025-12-31',
        nationality: 'USA',
        address: '456 Tech Ave, San Francisco, CA 94105',
      } : undefined,
      verificationScore: mockSuccess ? 0.92 : 0.25,
      checkResults: {
        documentAuthenticity: mockSuccess,
        documentIntegrity: mockSuccess,
        visualAuthenticity: mockSuccess,
        dataComparison: mockSuccess,
        imageQuality: mockSuccess ? 0.89 : 0.3,
      },
      rejectionReasons: mockSuccess ? [] : ['Document quality insufficient'],
    };
  }
}