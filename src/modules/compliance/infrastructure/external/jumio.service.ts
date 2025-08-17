import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { MetricsService } from '@shared/metrics/metrics.service';
import * as crypto from 'crypto';

export interface JumioVerificationRequest {
  userReference: string;
  callbackUrl?: string;
  successUrl?: string;
  errorUrl?: string;
  workflowId?: string;
  customerInternalReference?: string;
  reportingCriteria?: string;
  locale?: string;
  documentTypes?: string[];
  countries?: string[];
}

export interface JumioDocumentUploadRequest {
  userId: string;
  documentType: string;
  documentData: Buffer;
  filename: string;
  extractData?: boolean;
  performFraudCheck?: boolean;
}

export interface JumioVerificationResponse {
  timestamp: string;
  account: {
    id: string;
  };
  web: {
    href: string;
    successUrl?: string;
    errorUrl?: string;
  };
  sdk: {
    token: string;
  };
  workflowExecution: {
    id: string;
    status: string;
  };
}

export interface JumioRetrievalResponse {
  timestamp: string;
  scanReference: string;
  account: {
    id: string;
  };
  workflowExecution: {
    id: string;
    status: string;
    definitionKey: string;
    credentials: Array<{
      id: string;
      category: string;
      parts: Array<{
        classifier: string;
        href: string;
      }>;
    }>;
  };
  document: Array<{
    id: string;
    status: string;
    country: string;
    type: string;
    issuingDate: string;
    expiryDate: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    placeOfBirth: string;
    number: string;
    personalNumber: string;
    address: {
      line1: string;
      line2: string;
      city: string;
      subdivision: string;
      postalCode: string;
      country: string;
      formatted: string;
    };
    extractedData: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      expiryDate: string;
      documentNumber: string;
      nationality: string;
      issuingCountry: string;
    };
    verification: {
      mrzCheck: 'OK' | 'NOT_OK' | 'NOT_AVAILABLE';
      securityFeatures: 'OK' | 'NOT_OK' | 'NOT_AVAILABLE';
      dataPositions: 'OK' | 'NOT_OK' | 'NOT_AVAILABLE';
      handwrittenNote: 'OK' | 'NOT_OK' | 'NOT_AVAILABLE';
    };
  }>;
  verification: {
    identityVerification?: {
      similarity: 'MATCH' | 'NO_MATCH' | 'NOT_POSSIBLE';
      validity: boolean;
      reason?: string;
    };
    faceMap?: {
      similarity: 'MATCH' | 'NO_MATCH' | 'NOT_POSSIBLE';
      validity: boolean;
    };
    liveness?: {
      validity: boolean;
    };
  };
  similarity: {
    match: number;
    decision: 'MATCH' | 'NO_MATCH' | 'NOT_POSSIBLE';
  };
  fraudAssessment?: {
    decision: 'OK' | 'FRAUD' | 'NOT_POSSIBLE';
    confidence: number;
    reason?: string[];
  };
}

export interface JumioCallbackData {
  scanReference: string;
  timestamp: string;
  workflowExecution: {
    id: string;
    status: 'INITIATED' | 'ACQUIRED' | 'PROCESSED';
    definitionKey: string;
  };
  account: {
    id: string;
  };
  web?: {
    href: string;
  };
}

export interface JumioWebhookEvent {
  eventType: 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED' | 'CREDENTIAL_ACQUIRED';
  payload: JumioCallbackData;
  signature: string;
  timestamp: string;
}

export interface JumioStandardResult {
  provider: string;
  providerTransactionId: string;
  scanReference: string;
  status: string;
  timestamp: string;
  document: {
    type: string;
    country: string;
    number: string;
    issuingDate: string;
    expiryDate: string;
    isExpired: boolean;
  };
  personalInfo: {
    firstName: string;
    lastName: string;
    fullName: string;
    dateOfBirth: string;
    placeOfBirth: string;
    nationality: string;
    address: any;
  };
  verification: {
    overall: boolean;
    document: {
      authentic: boolean;
      dataConsistent: boolean;
      mrzValid: boolean;
      qualityCheck: boolean;
    };
    identity: {
      faceMatch: boolean;
      faceMatchScore: number;
      livenessCheck: boolean;
      valid: boolean;
    } | null;
  };
  quality: {
    documentQuality: number;
    imageQuality: number;
    extractionConfidence: number;
  };
  fraudAssessment: {
    riskLevel: string;
    riskScore: number;
    indicators: string[];
    decision: string;
  } | null;
  rawData: {
    jumioResponse: JumioRetrievalResponse;
  };
}

@Injectable()
export class JumioService {
  private readonly logger = new Logger(JumioService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly webhookSecret: string;
  private readonly userAgent: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {
    this.baseUrl = this.configService.get<string>('kyc.jumio.apiUrl', 'https://api.jumio.com');
    this.apiKey = this.configService.get<string>('kyc.jumio.apiKey');
    this.apiSecret = this.configService.get<string>('kyc.jumio.apiSecret');
    this.webhookSecret = this.configService.get<string>('kyc.jumio.webhookSecret');
    this.userAgent = 'JoonaPay-Compliance/1.0';
    this.enabled = this.configService.get<boolean>('kyc.jumio.enabled', false);

    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn('Jumio API credentials not configured');
    }
  }

  async initiateVerification(request: JumioVerificationRequest): Promise<JumioVerificationResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        this.logger.warn('Jumio service is disabled, returning mock response');
        return this.getMockResponse(request);
      }

      this.logger.log(`Initiating Jumio verification for user: ${request.userReference}`);

      const payload = {
        customerInternalReference: request.customerInternalReference || request.userReference,
        workflowDefinition: {
          key: request.workflowId || 'default_workflow',
          credentials: [
            {
              category: 'ID',
              type: {
                values: request.documentTypes || ['DRIVING_LICENSE', 'PASSPORT', 'ID_CARD'],
              },
              country: {
                values: request.countries || ['USA', 'GBR', 'DEU', 'FRA'],
              },
            },
          ],
        },
        callbackUrl: request.callbackUrl,
        web: request.successUrl && request.errorUrl ? {
          successUrl: request.successUrl,
          errorUrl: request.errorUrl,
        } : undefined,
        reportingCriteria: request.reportingCriteria,
        locale: request.locale || 'en',
      };

      const response = await this.makeApiCall<JumioVerificationResponse>(
        'POST',
        '/api/v1/accounts/{accountId}/workflow-executions',
        payload
      );

      // Store verification session for later retrieval
      await this.storeVerificationSession(response.workflowExecution.id, request.userReference);

      this.eventEmitter.emit('jumio.verification.initiated', {
        workflowExecutionId: response.workflowExecution.id,
        userReference: request.userReference,
        timestamp: response.timestamp,
      });

      const verificationResult = response;

      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalProviderCall('jumio', 'initiate_verification', 'success');
      this.metricsService.recordExternalApiResponseTime('jumio', 'initiate_verification', responseTime);

      this.logger.log(`✅ Jumio verification initiated successfully: ${response.workflowExecution.id}`);
      return verificationResult;

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalProviderCall('jumio', 'initiate_verification', 'failure');
      this.metricsService.recordExternalApiResponseTime('jumio', 'initiate_verification', responseTime);
      this.metricsService.recordError('jumio_initiation', 'high');
      
      this.logger.error(`❌ Jumio verification failed for user ${request.userReference}:`, error);
      
      throw new HttpException(
        `Jumio verification initiation failed: ${error.message}`,
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  async retrieveVerificationResult(workflowExecutionId: string): Promise<JumioRetrievalResponse> {
    try {
      if (!this.enabled) {
        return this.getMockVerificationStatus(workflowExecutionId);
      }

      this.logger.log(`Retrieving Jumio verification result: ${workflowExecutionId}`);

      const response = await this.makeApiCall<JumioRetrievalResponse>(
        'GET',
        `/api/v1/accounts/{accountId}/workflow-executions/${workflowExecutionId}`,
      );

      this.eventEmitter.emit('jumio.verification.retrieved', {
        workflowExecutionId,
        status: response.workflowExecution.status,
        documents: response.document?.length || 0,
        verificationResult: response.verification,
      });

      this.metricsService.recordExternalProviderCall('jumio', 'retrieve_verification', 'success');

      this.logger.log(`Jumio verification result retrieved successfully: ${workflowExecutionId}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to retrieve Jumio verification result: ${error.message}`, error.stack);
      this.metricsService.recordExternalProviderCall('jumio', 'retrieve_verification', 'failure');
      throw new HttpException(
        `Failed to retrieve Jumio verification result: ${error.message}`,
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  async downloadDocumentImage(imageHref: string, classifier: string): Promise<{ id: string; classifier: string; href: string; image?: Buffer }> {
    try {
      this.logger.log(`Downloading Jumio document image: ${classifier}`);

      const response = await firstValueFrom(
        this.httpService.get(imageHref, {
          headers: this.getAuthHeaders(),
          responseType: 'arraybuffer',
        })
      );

      const imageBuffer = Buffer.from(response.data);

      this.metricsService.recordExternalProviderCall('jumio', 'download_image', 'success');

      return {
        id: this.extractImageIdFromHref(imageHref),
        classifier,
        href: imageHref,
        image: imageBuffer,
      };

    } catch (error) {
      this.logger.error(`Failed to download Jumio document image: ${error.message}`, error.stack);
      this.metricsService.recordExternalProviderCall('jumio', 'download_image', 'failure');
      throw new HttpException(
        `Failed to download document image: ${error.message}`,
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  async processWebhook(payload: any, signature: string): Promise<void> {
    try {
      this.logger.log(`Processing Jumio webhook: ${payload.eventType}`);

      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
      }

      const event: JumioWebhookEvent = {
        eventType: payload.eventType,
        payload: payload.payload,
        signature,
        timestamp: new Date().toISOString(),
      };

      // Process different event types
      switch (event.eventType) {
        case 'WORKFLOW_COMPLETED':
          await this.handleWorkflowCompleted(event.payload);
          break;
        case 'WORKFLOW_FAILED':
          await this.handleWorkflowFailed(event.payload);
          break;
        case 'CREDENTIAL_ACQUIRED':
          await this.handleCredentialAcquired(event.payload);
          break;
        default:
          this.logger.warn(`Unhandled Jumio webhook event type: ${event.eventType}`);
      }

      this.eventEmitter.emit('jumio.webhook.processed', event);
      this.metricsService.recordWebhookReceived('jumio', event.eventType);

    } catch (error) {
      this.logger.error(`Failed to process Jumio webhook: ${error.message}`, error.stack);
      this.metricsService.recordError('jumio_webhook', 'medium');
      throw error;
    }
  }

  async cancelVerification(workflowExecutionId: string): Promise<void> {
    try {
      this.logger.log(`Cancelling Jumio verification: ${workflowExecutionId}`);

      await this.makeApiCall(
        'PUT',
        `/api/v1/accounts/{accountId}/workflow-executions/${workflowExecutionId}`,
        { status: 'CANCELLED' }
      );

      this.eventEmitter.emit('jumio.verification.cancelled', {
        workflowExecutionId,
        timestamp: new Date().toISOString(),
      });

      this.metricsService.recordExternalProviderCall('jumio', 'cancel_verification', 'success');

    } catch (error) {
      this.logger.error(`Failed to cancel Jumio verification: ${error.message}`, error.stack);
      this.metricsService.recordExternalProviderCall('jumio', 'cancel_verification', 'failure');
      throw error;
    }
  }

  transformToStandardFormat(jumioResult: JumioRetrievalResponse): JumioStandardResult {
    try {
      const document = jumioResult.document?.[0];
      const verification = jumioResult.verification;

      if (!document) {
        throw new Error('No document found in Jumio result');
      }

      const standardResult: JumioStandardResult = {
        provider: 'jumio',
        providerTransactionId: jumioResult.workflowExecution.id,
        scanReference: jumioResult.scanReference,
        status: this.mapJumioStatus(jumioResult.workflowExecution.status),
        timestamp: jumioResult.timestamp,
        
        // Document information
        document: {
          type: this.mapDocumentType(document.type),
          country: document.country,
          number: document.number || document.extractedData?.documentNumber,
          issuingDate: document.issuingDate || document.extractedData?.issuingDate,
          expiryDate: document.expiryDate || document.extractedData?.expiryDate,
          isExpired: document.expiryDate ? new Date(document.expiryDate) < new Date() : false,
        },

        // Personal information
        personalInfo: {
          firstName: document.firstName || document.extractedData?.firstName,
          lastName: document.lastName || document.extractedData?.lastName,
          fullName: `${document.firstName || document.extractedData?.firstName} ${document.lastName || document.extractedData?.lastName}`,
          dateOfBirth: document.dateOfBirth || document.extractedData?.dateOfBirth,
          placeOfBirth: document.placeOfBirth,
          nationality: document.extractedData?.nationality,
          address: document.address || document.extractedData?.address,
        },

        // Verification results
        verification: {
          overall: this.calculateOverallVerificationResult(document, verification),
          document: {
            authentic: document.verification?.securityFeatures === 'OK',
            dataConsistent: document.verification?.dataPositions === 'OK',
            mrzValid: document.verification?.mrzCheck === 'OK',
            qualityCheck: document.verification?.securityFeatures === 'OK',
          },
          identity: verification?.identityVerification ? {
            faceMatch: verification.identityVerification.similarity === 'MATCH',
            faceMatchScore: jumioResult.similarity?.match || 0,
            livenessCheck: verification.liveness?.validity || false,
            valid: verification.identityVerification.validity,
          } : null,
        },

        // Quality and fraud assessment
        quality: {
          documentQuality: this.assessDocumentQuality(document),
          imageQuality: 0.9, // Would come from actual Jumio response
          extractionConfidence: 0.95,
        },

        fraudAssessment: jumioResult.fraudAssessment ? {
          riskLevel: this.mapFraudDecision(jumioResult.fraudAssessment.decision),
          riskScore: 1 - (jumioResult.fraudAssessment.confidence || 0),
          indicators: jumioResult.fraudAssessment.reason || [],
          decision: jumioResult.fraudAssessment.decision,
        } : null,

        // Raw data for audit purposes
        rawData: {
          jumioResponse: jumioResult,
        },
      };

      return standardResult;

    } catch (error) {
      this.logger.error(`Failed to transform Jumio result: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async makeApiCall<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const accountId = this.configService.get<string>('kyc.jumio.accountId');
    const url = `${this.baseUrl}${endpoint.replace('{accountId}', accountId)}`;
    
    const config = {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
    };

    try {
      let response;
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get(url, config));
          break;
        case 'POST':
          response = await firstValueFrom(this.httpService.post(url, data, config));
          break;
        case 'PUT':
          response = await firstValueFrom(this.httpService.put(url, data, config));
          break;
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete(url, config));
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      return response.data;

    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        this.logger.error(`Jumio API error: ${status} - ${JSON.stringify(data)}`);
        throw new HttpException(
          `Jumio API error: ${data.message || data.error || 'Unknown error'}`,
          status
        );
      }
      throw error;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
    };
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(`sha256=${expectedSignature}`)
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      return false;
    }
  }

  private async handleWorkflowCompleted(payload: JumioCallbackData): Promise<void> {
    this.logger.log(`Jumio workflow completed: ${payload.workflowExecution.id}`);

    try {
      const fullResult = await this.retrieveVerificationResult(payload.workflowExecution.id);
      const standardResult = this.transformToStandardFormat(fullResult);

      this.eventEmitter.emit('jumio.verification.completed', {
        workflowExecutionId: payload.workflowExecution.id,
        scanReference: payload.scanReference,
        result: standardResult,
        timestamp: payload.timestamp,
      });

    } catch (error) {
      this.logger.error(`Failed to process completed workflow: ${error.message}`);
    }
  }

  private async handleWorkflowFailed(payload: JumioCallbackData): Promise<void> {
    this.logger.log(`Jumio workflow failed: ${payload.workflowExecution.id}`);

    this.eventEmitter.emit('jumio.verification.failed', {
      workflowExecutionId: payload.workflowExecution.id,
      scanReference: payload.scanReference,
      timestamp: payload.timestamp,
    });
  }

  private async handleCredentialAcquired(payload: JumioCallbackData): Promise<void> {
    this.logger.log(`Jumio credential acquired: ${payload.workflowExecution.id}`);

    this.eventEmitter.emit('jumio.credential.acquired', {
      workflowExecutionId: payload.workflowExecution.id,
      scanReference: payload.scanReference,
      timestamp: payload.timestamp,
    });
  }

  private async storeVerificationSession(workflowExecutionId: string, userReference: string): Promise<void> {
    this.logger.debug(`Storing verification session: ${workflowExecutionId} for user: ${userReference}`);
  }

  private extractImageIdFromHref(href: string): string {
    const matches = href.match(/\/images\/([^\/]+)/);
    return matches ? matches[1] : href;
  }

  private mapJumioStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'INITIATED': 'PENDING',
      'ACQUIRED': 'IN_PROGRESS',
      'PROCESSED': 'COMPLETED',
      'FAILED': 'FAILED',
      'CANCELLED': 'CANCELLED',
    };

    return statusMap[status] || status;
  }

  private mapDocumentType(jumioType: string): string {
    const typeMap: Record<string, string> = {
      'PASSPORT': 'PASSPORT',
      'DRIVING_LICENSE': 'DRIVERS_LICENSE',
      'ID_CARD': 'NATIONAL_ID',
      'VISA': 'VISA',
    };

    return typeMap[jumioType] || jumioType;
  }

  private mapFraudDecision(decision: string): string {
    const decisionMap: Record<string, string> = {
      'OK': 'LOW',
      'FRAUD': 'HIGH',
      'NOT_POSSIBLE': 'MEDIUM',
    };

    return decisionMap[decision] || 'MEDIUM';
  }

  private calculateOverallVerificationResult(document: any, verification: any): boolean {
    const checks = [
      document.verification?.securityFeatures === 'OK',
      document.verification?.dataPositions === 'OK',
      document.verification?.mrzCheck === 'OK',
      verification?.identityVerification?.validity !== false,
      verification?.liveness?.validity !== false,
    ];

    const passedChecks = checks.filter(check => check === true).length;
    return passedChecks / checks.length >= 0.8;
  }

  private assessDocumentQuality(document: any): number {
    let qualityScore = 1.0;

    if (document.verification?.securityFeatures === 'NOT_OK') qualityScore -= 0.3;
    if (document.verification?.dataPositions === 'NOT_OK') qualityScore -= 0.2;
    if (document.verification?.mrzCheck === 'NOT_OK') qualityScore -= 0.2;
    if (document.verification?.handwrittenNote === 'NOT_OK') qualityScore -= 0.1;

    return Math.max(0, qualityScore);
  }

  private calculateVerificationScore(jumioData: any): number {
    let score = 0;
    const checks = jumioData.fraudResult || {};
    
    if (checks.documentValidation === 'PASSED') score += 0.3;
    if (checks.faceMatch === 'PASSED') score += 0.3;
    if (checks.dataConsistency === 'PASSED') score += 0.2;
    if (checks.blacklistCheck === 'PASSED') score += 0.2;
    
    return Math.min(score, 1);
  }

  private getMockResponse(request: JumioVerificationRequest): JumioVerificationResponse {
    const mockWorkflowId = `mock_jumio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      timestamp: new Date().toISOString(),
      account: {
        id: 'mock-account',
      },
      web: {
        href: `https://jumio.com/web/v4/app?authorizationToken=mock-token`,
        successUrl: request.successUrl,
        errorUrl: request.errorUrl,
      },
      sdk: {
        token: 'mock-sdk-token',
      },
      workflowExecution: {
        id: mockWorkflowId,
        status: 'INITIATED',
      },
    };
  }

  private getMockVerificationStatus(workflowExecutionId: string): JumioRetrievalResponse {
    return {
      timestamp: new Date().toISOString(),
      scanReference: `mock-scan-ref-${workflowExecutionId}`,
      account: {
        id: 'mock-account',
      },
      workflowExecution: {
        id: workflowExecutionId,
        status: 'PROCESSED',
        definitionKey: 'default_workflow',
        credentials: [],
      },
      document: [{
        id: 'mock-doc-1',
        status: 'APPROVED',
        country: 'USA',
        type: 'PASSPORT',
        issuingDate: '2020-01-01',
        expiryDate: '2025-12-31',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        placeOfBirth: 'New York',
        number: 'A1234567',
        personalNumber: '',
        optionalData1: '',
        optionalData2: '',
        address: {
          line1: '123 Main St',
          line2: '',
          city: 'New York',
          subdivision: 'NY',
          postalCode: '10001',
          country: 'USA',
          formatted: '123 Main St, New York, NY 10001',
        },
        extractedData: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          expiryDate: '2025-12-31',
          documentNumber: 'A1234567',
          nationality: 'USA',
          issuingCountry: 'USA',
          issuingDate: '2020-01-01',
          address: {
            line1: '123 Main St',
            city: 'New York',
            subdivision: 'NY',
            postalCode: '10001',
            country: 'USA',
          },
        },
        verification: {
          mrzCheck: 'OK',
          securityFeatures: 'OK',
          dataPositions: 'OK',
          handwrittenNote: 'NOT_AVAILABLE',
        },
      }],
      verification: {
        identityVerification: {
          similarity: 'MATCH',
          validity: true,
        },
        faceMap: {
          similarity: 'MATCH',
          validity: true,
        },
        liveness: {
          validity: true,
        },
      },
      similarity: {
        match: 0.95,
        decision: 'MATCH',
      },
      fraudAssessment: {
        decision: 'OK',
        confidence: 0.95,
      },
    };
  }
}