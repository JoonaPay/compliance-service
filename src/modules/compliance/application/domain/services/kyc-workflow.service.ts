import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from '@shared/metrics/metrics.service';
import { KycVerification, KycLevel, KycStatus, DocumentType, RiskAssessment } from '../entities/kyc-verification.entity';
import { KycVerificationRepository } from '../repositories/kyc-verification.repository';
import { SanctionsScreeningService } from './sanctions-screening.service';
import { DocumentVerificationService } from './document-verification.service';
import { ComplianceRulesService } from './compliance-rules.service';
import { 
  InitiateKycRequestDto, 
  UploadDocumentRequestDto, 
  SubmitKycRequestDto, 
  ReviewKycRequestDto, 
  BulkProcessRequestDto,
  KycQueryDto 
} from '../../dto/requests/kyc-requests.dto';
import { 
  KycVerificationResponseDto, 
  KycStatisticsResponseDto, 
  KycListResponseDto, 
  BulkProcessResponseDto,
  DocumentUploadResponseDto,
  RequiredDocumentsResponseDto 
} from '../../dto/responses/kyc-responses.dto';

export interface KycWorkflowEvent {
  verificationId: string;
  userId: string;
  event: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface KycStateMachine {
  currentState: KycStatus;
  allowedTransitions: KycStatus[];
  requiredActions: string[];
  autoTransitions: boolean;
}

@Injectable()
export class KycWorkflowService {
  private readonly logger = new Logger(KycWorkflowService.name);
  
  private readonly stateMachine: Record<KycStatus, KycStateMachine> = {
    [KycStatus.PENDING]: {
      currentState: KycStatus.PENDING,
      allowedTransitions: [KycStatus.IN_PROGRESS, KycStatus.REJECTED],
      requiredActions: ['upload_documents'],
      autoTransitions: true,
    },
    [KycStatus.IN_PROGRESS]: {
      currentState: KycStatus.IN_PROGRESS,
      allowedTransitions: [KycStatus.APPROVED, KycStatus.REJECTED, KycStatus.REQUIRES_MANUAL_REVIEW],
      requiredActions: ['complete_documents', 'risk_assessment'],
      autoTransitions: true,
    },
    [KycStatus.REQUIRES_MANUAL_REVIEW]: {
      currentState: KycStatus.REQUIRES_MANUAL_REVIEW,
      allowedTransitions: [KycStatus.APPROVED, KycStatus.REJECTED],
      requiredActions: ['manual_review'],
      autoTransitions: false,
    },
    [KycStatus.APPROVED]: {
      currentState: KycStatus.APPROVED,
      allowedTransitions: [KycStatus.EXPIRED],
      requiredActions: [],
      autoTransitions: true,
    },
    [KycStatus.REJECTED]: {
      currentState: KycStatus.REJECTED,
      allowedTransitions: [],
      requiredActions: [],
      autoTransitions: false,
    },
    [KycStatus.EXPIRED]: {
      currentState: KycStatus.EXPIRED,
      allowedTransitions: [],
      requiredActions: [],
      autoTransitions: false,
    },
  };

  constructor(
    private readonly kycRepository: KycVerificationRepository,
    private readonly sanctionsService: SanctionsScreeningService,
    private readonly documentService: DocumentVerificationService,
    private readonly complianceRules: ComplianceRulesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  async initiateKyc(request: InitiateKycRequestDto, ipAddress?: string, userAgent?: string): Promise<KycVerificationResponseDto> {
    try {
      this.logger.log(`Initiating KYC verification for user: ${request.userId}, level: ${request.level}`);

      // Check if user already has an active KYC
      const existingKycs = await this.kycRepository.findByUserId(request.userId);
      const activeKyc = existingKycs.find(kyc => 
        kyc.status === KycStatus.PENDING || 
        kyc.status === KycStatus.IN_PROGRESS || 
        kyc.status === KycStatus.REQUIRES_MANUAL_REVIEW ||\n        kyc.isApproved()\n      );
      
      if (activeKyc) {
        if (activeKyc.isApproved()) {
          throw new ConflictException('User already has an approved KYC verification');
        } else {
          throw new ConflictException(`User already has an active KYC verification in status: ${activeKyc.status}`);
        }
      }

      // Validate compliance rules for KYC initiation
      await this.complianceRules.validateKycInitiation(request);

      const verificationId = this.generateVerificationId();
      const kyc = KycVerification.create({
        id: verificationId,
        userId: request.userId,
        level: request.level,
        provider: request.provider || this.getDefaultProvider(),
        personalInfo: request.personalInfo,
        callbackUrl: request.callbackUrl,
        metadata: {
          ...request.metadata,
          initiatedAt: new Date().toISOString(),
          ipAddress,
          userAgent,
        },
      });

      // Perform initial pre-screening if personal info provided
      if (request.personalInfo) {
        await this.performInitialScreening(kyc);
      }

      const savedKyc = await this.kycRepository.save(kyc);

      // Emit workflow event
      await this.emitWorkflowEvent(savedKyc, 'kyc.initiated', {
        level: savedKyc.level,
        provider: savedKyc.provider,
        hasPersonalInfo: !!request.personalInfo,
      });

      this.metricsService.recordComplianceOperation('kyc_initiated', 'success');
      this.metricsService.incrementKycByStatus('pending');
      this.metricsService.recordKycByLevel(request.level);

      this.logger.log(`KYC verification initiated successfully: ${savedKyc.id}`);
      return this.mapToResponseDto(savedKyc);

    } catch (error) {
      this.logger.error(`Failed to initiate KYC verification: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_initiated', 'failure');
      this.metricsService.recordError('kyc_initiation', 'high');
      throw error;
    }
  }

  async uploadDocument(request: UploadDocumentRequestDto, file: Express.Multer.File, ipAddress?: string): Promise<KycVerificationResponseDto> {
    try {
      this.logger.log(`Uploading document for KYC: ${request.verificationId}, type: ${request.documentType}`);

      const kyc = await this.getKycVerification(request.verificationId);

      // Validate state transition
      if (!this.canTransitionFrom(kyc.status, [KycStatus.PENDING, KycStatus.IN_PROGRESS])) {
        throw new BadRequestException(`Cannot upload documents for KYC in status: ${kyc.status}`);
      }

      // Validate document type is required for this KYC level
      const requiredDocs = this.getRequiredDocuments(kyc.level);
      if (!requiredDocs.includes(request.documentType)) {
        throw new BadRequestException(`Document type ${request.documentType} not required for KYC level ${kyc.level}`);
      }

      // Check if document already uploaded
      const existingDoc = kyc.documents.find(doc => doc.type === request.documentType && doc.documentSide === request.documentSide);
      if (existingDoc) {
        throw new ConflictException(`Document of type ${request.documentType} already uploaded`);
      }

      // Upload and verify document
      const documentResult = await this.documentService.uploadAndVerify({
        file: file.buffer,
        filename: file.originalname,
        contentType: file.mimetype,
        documentType: request.documentType,
        verificationId: request.verificationId,
        documentSide: request.documentSide,
        extractData: request.extractData ?? true,
        ipAddress,
      });

      const document = {
        id: this.generateDocumentId(),
        type: request.documentType,
        filename: file.originalname,
        documentSide: request.documentSide,
        url: documentResult.url,
        extractedData: documentResult.extractedData,
        verificationResults: documentResult.verificationResults,
        uploadedAt: new Date(),
      };

      let updatedKyc = kyc.addDocument(document);

      // Auto-transition to IN_PROGRESS if first document
      if (kyc.status === KycStatus.PENDING) {
        updatedKyc = this.transitionState(updatedKyc, KycStatus.IN_PROGRESS);
      }

      // Check if all required documents are uploaded and trigger risk assessment
      if (updatedKyc.hasAllRequiredDocuments()) {
        updatedKyc = await this.performAutomaticRiskAssessment(updatedKyc);
      }

      const savedKyc = await this.kycRepository.save(updatedKyc);

      await this.emitWorkflowEvent(savedKyc, 'kyc.document.uploaded', {
        documentType: request.documentType,
        documentId: document.id,
        documentsComplete: savedKyc.hasAllRequiredDocuments(),
      });

      this.metricsService.recordComplianceOperation('kyc_document_uploaded', 'success');
      this.metricsService.recordDocumentUpload(request.documentType);

      this.logger.log(`Document uploaded successfully for KYC: ${savedKyc.id}`);
      return this.mapToResponseDto(savedKyc);

    } catch (error) {
      this.logger.error(`Failed to upload document for KYC: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_document_uploaded', 'failure');
      this.metricsService.recordError('kyc_document_upload', 'high');
      throw error;
    }
  }

  async submitKyc(request: SubmitKycRequestDto, ipAddress?: string, userAgent?: string): Promise<KycVerificationResponseDto> {
    try {
      this.logger.log(`Submitting KYC verification: ${request.verificationId}`);

      const kyc = await this.getKycVerification(request.verificationId);

      if (kyc.status !== KycStatus.IN_PROGRESS) {
        throw new BadRequestException(`Cannot submit KYC in status: ${kyc.status}`);
      }

      if (!kyc.hasAllRequiredDocuments()) {
        throw new BadRequestException('Cannot submit KYC without all required documents');
      }

      if (!request.finalDeclaration) {
        throw new BadRequestException('Final declaration must be confirmed');
      }

      // Update metadata with submission info
      const updatedMetadata = {
        ...kyc.metadata,
        submittedAt: new Date().toISOString(),
        finalDeclaration: true,
        submissionIpAddress: ipAddress,
        submissionUserAgent: userAgent,
      };

      let updatedKyc = kyc.updateMetadata(updatedMetadata);
      updatedKyc = updatedKyc.submit();

      // Perform final risk assessment if not already done
      if (!updatedKyc.riskAssessment) {
        updatedKyc = await this.performAutomaticRiskAssessment(updatedKyc);
      }

      const savedKyc = await this.kycRepository.save(updatedKyc);

      await this.emitWorkflowEvent(savedKyc, 'kyc.submitted', {
        finalDeclaration: request.finalDeclaration,
        status: savedKyc.status,
        riskScore: savedKyc.riskAssessment?.score,
      });

      this.metricsService.recordComplianceOperation('kyc_submitted', 'success');

      this.logger.log(`KYC verification submitted successfully: ${savedKyc.id}`);
      return this.mapToResponseDto(savedKyc);

    } catch (error) {
      this.logger.error(`Failed to submit KYC verification: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_submitted', 'failure');
      this.metricsService.recordError('kyc_submission', 'high');
      throw error;
    }
  }

  async reviewKyc(request: ReviewKycRequestDto): Promise<KycVerificationResponseDto> {
    try {
      this.logger.log(`Manual review for KYC: ${request.verificationId} by ${request.reviewedBy}`);

      const kyc = await this.getKycVerification(request.verificationId);

      if (!this.canTransitionFrom(kyc.status, [KycStatus.REQUIRES_MANUAL_REVIEW, KycStatus.IN_PROGRESS])) {
        throw new BadRequestException(`Cannot review KYC in status: ${kyc.status}`);
      }

      let updatedKyc: KycVerification;

      if (request.approve) {
        // Additional validation for approval
        if (kyc.riskAssessment && kyc.riskAssessment.sanctionsMatch && !request.riskOverride) {
          throw new BadRequestException('Cannot approve KYC with sanctions match without risk override');
        }

        updatedKyc = this.transitionState(kyc, KycStatus.APPROVED, request.reviewedBy, request.notes);
      } else {
        if (!request.rejectionReason) {
          throw new BadRequestException('Rejection reason is required when rejecting KYC');
        }
        updatedKyc = kyc.reject(request.rejectionReason, request.reviewedBy);
      }

      const savedKyc = await this.kycRepository.save(updatedKyc);

      await this.emitWorkflowEvent(savedKyc, 'kyc.reviewed', {
        approved: request.approve,
        reviewedBy: request.reviewedBy,
        riskOverride: request.riskOverride,
        status: savedKyc.status,
      });

      this.metricsService.recordComplianceOperation('kyc_reviewed', 'success');
      this.metricsService.updateKycStatusMetrics(kyc.status, savedKyc.status);

      this.logger.log(`KYC review completed: ${savedKyc.id}, approved: ${request.approve}`);
      return this.mapToResponseDto(savedKyc);

    } catch (error) {
      this.logger.error(`Failed to review KYC: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_reviewed', 'failure');
      this.metricsService.recordError('kyc_review', 'high');
      throw error;
    }
  }

  async bulkProcess(request: BulkProcessRequestDto): Promise<BulkProcessResponseDto> {
    const results: BulkProcessResponseDto = {
      successfulIds: [],
      failedIds: [],
      totalProcessed: request.verificationIds.length,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    for (const verificationId of request.verificationIds) {
      try {
        switch (request.action) {
          case 'approve':
            await this.reviewKyc({
              verificationId,
              approve: true,
              reviewedBy: request.reviewedBy,
              notes: request.reason,
            });
            break;
          case 'reject':
            await this.reviewKyc({
              verificationId,
              approve: false,
              reviewedBy: request.reviewedBy,
              rejectionReason: request.reason,
            });
            break;
          case 'review':
            // Mark for manual review
            const kyc = await this.getKycVerification(verificationId);
            const updatedKyc = this.transitionState(kyc, KycStatus.REQUIRES_MANUAL_REVIEW, request.reviewedBy, request.reason);
            await this.kycRepository.save(updatedKyc);
            break;
        }
        
        results.successfulIds.push(verificationId);
        results.totalSuccessful++;
      } catch (error) {
        results.failedIds.push({
          id: verificationId,
          error: error.message,
        });
        results.totalFailed++;
      }
    }

    this.metricsService.recordBulkOperation('kyc', request.action, results.totalSuccessful, results.totalFailed);
    return results;
  }

  async getKycVerification(verificationId: string): Promise<KycVerification> {
    const kyc = await this.kycRepository.findById(verificationId);
    if (!kyc) {
      throw new NotFoundException(`KYC verification not found: ${verificationId}`);
    }
    return kyc;
  }

  async getKycVerificationDto(verificationId: string): Promise<KycVerificationResponseDto> {
    const kyc = await this.getKycVerification(verificationId);
    return this.mapToResponseDto(kyc);
  }

  async getUserKycVerifications(userId: string): Promise<KycVerificationResponseDto[]> {
    const kycs = await this.kycRepository.findByUserId(userId);
    return kycs.map(kyc => this.mapToResponseDto(kyc));
  }

  async queryKycVerifications(query: KycQueryDto): Promise<KycListResponseDto> {
    const { items, total } = await this.kycRepository.findWithFilters(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      items: items.map(kyc => this.mapToResponseDto(kyc)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
    };
  }

  async getKycStatistics(dateFrom?: Date, dateTo?: Date): Promise<KycStatisticsResponseDto> {
    const stats = await this.kycRepository.getStatistics(dateFrom, dateTo);
    return stats;
  }

  async getRequiredDocuments(level: KycLevel): Promise<RequiredDocumentsResponseDto> {
    const requiredDocs = this.getRequiredDocuments(level);
    const optionalDocs = this.getOptionalDocuments(level);
    const requirements = this.getDocumentRequirements();

    return {
      level,
      requiredDocuments: requiredDocs,
      optionalDocuments: optionalDocs,
      requirements,
    };
  }

  async generateDocumentUploadUrl(verificationId: string, documentType: DocumentType): Promise<DocumentUploadResponseDto> {
    const kyc = await this.getKycVerification(verificationId);
    
    if (!this.canTransitionFrom(kyc.status, [KycStatus.PENDING, KycStatus.IN_PROGRESS])) {
      throw new BadRequestException(`Cannot upload documents for KYC in status: ${kyc.status}`);
    }

    return this.documentService.generateUploadUrl(verificationId, documentType);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processExpiredKycs(): Promise<void> {
    try {
      this.logger.log('Processing expired KYC verifications');

      const expiredKycs = await this.kycRepository.findExpired();
      
      for (const kyc of expiredKycs) {
        const updatedKyc = this.transitionState(kyc, KycStatus.EXPIRED);
        await this.kycRepository.save(updatedKyc);

        await this.emitWorkflowEvent(updatedKyc, 'kyc.expired', {
          expiredAt: kyc.expiresAt,
          previousStatus: kyc.status,
        });

        this.metricsService.updateKycStatusMetrics(kyc.status, KycStatus.EXPIRED);
      }

      this.logger.log(`Processed ${expiredKycs.length} expired KYC verifications`);

    } catch (error) {
      this.logger.error(`Failed to process expired KYCs: ${error.message}`, error.stack);
      this.metricsService.recordError('kyc_expiry_processing', 'medium');
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async processStaleKycs(): Promise<void> {
    try {
      this.logger.log('Processing stale KYC verifications');

      const staleThresholdHours = this.configService.get<number>('compliance.kyc.staleThresholdHours', 72);
      const staleKycs = await this.kycRepository.findStale(staleThresholdHours);

      for (const kyc of staleKycs) {
        await this.emitWorkflowEvent(kyc, 'kyc.stale_warning', {
          hoursStale: Math.floor((Date.now() - kyc.createdAt.getTime()) / (1000 * 60 * 60)),
          status: kyc.status,
        });
      }

      this.logger.log(`Processed ${staleKycs.length} stale KYC verifications`);

    } catch (error) {
      this.logger.error(`Failed to process stale KYCs: ${error.message}`, error.stack);
    }
  }

  private async performInitialScreening(kyc: KycVerification): Promise<void> {
    if (!kyc.personalInfo) return;

    try {
      // Perform basic sanctions screening on personal info
      const screeningResult = await this.sanctionsService.quickScreen({
        firstName: kyc.personalInfo.firstName,
        lastName: kyc.personalInfo.lastName,
        dateOfBirth: new Date(kyc.personalInfo.dateOfBirth),
        nationality: kyc.personalInfo.nationality,
      });

      if (screeningResult.sanctionsMatch || screeningResult.pepMatch) {
        kyc.addRiskFlag('initial_screening_hit');
      }
    } catch (error) {
      this.logger.warn(`Initial screening failed for KYC ${kyc.id}: ${error.message}`);
    }
  }

  private async performAutomaticRiskAssessment(kyc: KycVerification): Promise<KycVerification> {
    try {
      // Extract personal data from documents
      const personalData = this.extractPersonalDataFromDocuments(kyc);

      // Perform comprehensive sanctions screening
      const sanctionsResult = await this.sanctionsService.screenIndividual({
        fullName: `${personalData.firstName} ${personalData.lastName}`,
        dateOfBirth: personalData.dateOfBirth,
        nationality: personalData.nationality,
        address: personalData.address,
      });

      // Calculate risk score
      const riskScore = await this.complianceRules.calculateRiskScore({
        documentQuality: this.assessDocumentQuality(kyc),
        sanctionsResult,
        countryRisk: await this.complianceRules.getCountryRisk(personalData.nationality),
        ageVerification: this.verifyAge(personalData.dateOfBirth),
        personalInfo: personalData,
      });

      const riskAssessment: RiskAssessment = {
        score: riskScore.score,
        factors: riskScore.factors,
        sanctionsMatch: sanctionsResult.sanctionsMatch,
        pepMatch: sanctionsResult.pepMatch,
        adverseMediaMatch: sanctionsResult.adverseMediaMatch,
        countryRisk: sanctionsResult.countryRisk,
        assessedAt: new Date(),
      };

      let updatedKyc = kyc.updateRiskAssessment(riskAssessment);

      // Determine next state based on risk assessment
      const nextState = this.determineStateFromRisk(updatedKyc);
      if (nextState !== updatedKyc.status) {
        updatedKyc = this.transitionState(updatedKyc, nextState);
      }

      await this.emitWorkflowEvent(updatedKyc, 'kyc.risk_assessed', {
        riskScore: riskAssessment.score,
        sanctionsMatch: riskAssessment.sanctionsMatch,
        pepMatch: riskAssessment.pepMatch,
        nextState,
      });

      this.metricsService.recordRiskScore('kyc', riskAssessment.score);

      return updatedKyc;

    } catch (error) {
      this.logger.error(`Risk assessment failed for KYC ${kyc.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private determineStateFromRisk(kyc: KycVerification): KycStatus {
    if (!kyc.riskAssessment) return kyc.status;

    const autoApprovalThreshold = this.configService.get<number>('compliance.autoApprovalThreshold', 0.95);
    const manualReviewThreshold = this.configService.get<number>('compliance.manualReviewThreshold', 0.5);

    if (kyc.canBeAutoApproved(autoApprovalThreshold)) {
      return KycStatus.APPROVED;
    }

    if (kyc.requiresManualReview(manualReviewThreshold)) {
      return KycStatus.REQUIRES_MANUAL_REVIEW;
    }

    return kyc.status;
  }

  private canTransitionFrom(currentState: KycStatus, allowedStates: KycStatus[]): boolean {
    return allowedStates.includes(currentState);
  }

  private transitionState(kyc: KycVerification, newState: KycStatus, reviewedBy?: string, notes?: string): KycVerification {
    const stateMachine = this.stateMachine[kyc.status];
    
    if (!stateMachine.allowedTransitions.includes(newState)) {
      throw new BadRequestException(`Cannot transition from ${kyc.status} to ${newState}`);
    }

    return kyc.updateStatus(newState, reviewedBy, notes);
  }

  private getRequiredDocuments(level: KycLevel): DocumentType[] {
    switch (level) {
      case KycLevel.BASIC:
        return [DocumentType.NATIONAL_ID, DocumentType.SELFIE];
      case KycLevel.STANDARD:
        return [DocumentType.PASSPORT, DocumentType.UTILITY_BILL, DocumentType.SELFIE];
      case KycLevel.ENHANCED:
        return [
          DocumentType.PASSPORT,
          DocumentType.UTILITY_BILL,
          DocumentType.BANK_STATEMENT,
          DocumentType.VIDEO_SELFIE,
        ];
      default:
        return [];
    }
  }

  private getOptionalDocuments(level: KycLevel): DocumentType[] {
    switch (level) {
      case KycLevel.BASIC:
        return [DocumentType.DRIVERS_LICENSE];
      case KycLevel.STANDARD:
        return [DocumentType.DRIVERS_LICENSE, DocumentType.BANK_STATEMENT];
      case KycLevel.ENHANCED:
        return [DocumentType.BIRTH_CERTIFICATE];
      default:
        return [];
    }
  }

  private getDocumentRequirements(): Record<string, any> {
    return {
      [DocumentType.PASSPORT]: {
        description: 'Valid government-issued passport',
        acceptedFormats: ['JPG', 'PNG', 'PDF'],
        maxSizeMB: 10,
        qualityRequirements: ['High resolution', 'Clear text', 'All corners visible'],
      },
      [DocumentType.DRIVERS_LICENSE]: {
        description: 'Valid driver\'s license (front and back)',
        acceptedFormats: ['JPG', 'PNG'],
        maxSizeMB: 10,
        qualityRequirements: ['High resolution', 'Clear text', 'No glare'],
      },
      [DocumentType.NATIONAL_ID]: {
        description: 'Government-issued national ID card',
        acceptedFormats: ['JPG', 'PNG'],
        maxSizeMB: 10,
        qualityRequirements: ['High resolution', 'Clear text', 'All edges visible'],
      },
      [DocumentType.UTILITY_BILL]: {
        description: 'Recent utility bill (within 3 months)',
        acceptedFormats: ['JPG', 'PNG', 'PDF'],
        maxSizeMB: 10,
        qualityRequirements: ['Clear text', 'Full document visible', 'Recent date'],
      },
      [DocumentType.BANK_STATEMENT]: {
        description: 'Recent bank statement (within 3 months)',
        acceptedFormats: ['JPG', 'PNG', 'PDF'],
        maxSizeMB: 10,
        qualityRequirements: ['Clear text', 'Bank letterhead visible', 'Recent date'],
      },
      [DocumentType.SELFIE]: {
        description: 'Clear selfie photo',
        acceptedFormats: ['JPG', 'PNG'],
        maxSizeMB: 5,
        qualityRequirements: ['Face clearly visible', 'Good lighting', 'No sunglasses'],
      },
      [DocumentType.VIDEO_SELFIE]: {
        description: 'Video selfie with voice confirmation',
        acceptedFormats: ['MP4', 'MOV'],
        maxSizeMB: 50,
        qualityRequirements: ['Face clearly visible', 'Audio audible', 'Specific phrases'],
      },
    };
  }

  private extractPersonalDataFromDocuments(kyc: KycVerification): any {
    const extractedData: any = {};
    
    kyc.documents.forEach(doc => {
      if (doc.extractedData) {
        Object.assign(extractedData, doc.extractedData);
      }
    });

    // Fallback to personalInfo if no extraction
    if (kyc.personalInfo && Object.keys(extractedData).length === 0) {
      return {
        firstName: kyc.personalInfo.firstName,
        lastName: kyc.personalInfo.lastName,
        dateOfBirth: new Date(kyc.personalInfo.dateOfBirth),
        nationality: kyc.personalInfo.nationality,
        address: kyc.personalInfo.address,
      };
    }

    return {
      firstName: extractedData.firstName || extractedData.given_name,
      lastName: extractedData.lastName || extractedData.family_name,
      dateOfBirth: extractedData.dateOfBirth ? new Date(extractedData.dateOfBirth) : undefined,
      nationality: extractedData.nationality || extractedData.country,
      address: extractedData.address,
    };
  }

  private assessDocumentQuality(kyc: KycVerification): number {
    if (kyc.documents.length === 0) return 0;

    const scores = kyc.documents.map(doc => {
      if (!doc.verificationResults) return 0.5;
      
      const results = doc.verificationResults;
      let docScore = 1.0;

      if (results.imageQuality && results.imageQuality < 0.8) docScore -= 0.2;
      if (results.documentAuthenticity && results.documentAuthenticity < 0.9) docScore -= 0.3;
      if (results.faceMatch && results.faceMatch < 0.8) docScore -= 0.2;
      if (results.extractionConfidence && results.extractionConfidence < 0.8) docScore -= 0.1;

      return Math.max(0, docScore);
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private verifyAge(dateOfBirth?: Date): boolean {
    if (!dateOfBirth) return false;
    
    const age = Math.floor((Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const minAge = this.configService.get<number>('compliance.minAge', 18);
    return age >= minAge;
  }

  private async emitWorkflowEvent(kyc: KycVerification, event: string, data: Record<string, any>): Promise<void> {
    const workflowEvent: KycWorkflowEvent = {
      verificationId: kyc.id,
      userId: kyc.userId,
      event,
      data,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(event, workflowEvent);

    // Also emit generic workflow event for monitoring
    this.eventEmitter.emit('kyc.workflow.event', workflowEvent);
  }

  private mapToResponseDto(kyc: KycVerification): KycVerificationResponseDto {
    return {
      id: kyc.id,
      userId: kyc.userId,
      level: kyc.level,
      status: kyc.status as any,
      documents: kyc.documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        filename: doc.filename,
        url: doc.url,
        uploadedAt: doc.uploadedAt,
        extractedData: doc.extractedData,
        verificationResults: doc.verificationResults,
      })),
      riskAssessment: kyc.riskAssessment ? {
        score: kyc.riskAssessment.score,
        factors: kyc.riskAssessment.factors,
        sanctionsMatch: kyc.riskAssessment.sanctionsMatch,
        pepMatch: kyc.riskAssessment.pepMatch,
        adverseMediaMatch: kyc.riskAssessment.adverseMediaMatch,
        countryRisk: kyc.riskAssessment.countryRisk,
        assessedAt: kyc.riskAssessment.assessedAt,
      } : undefined,
      provider: kyc.provider,
      providerReference: kyc.providerReference,
      reviewedBy: kyc.reviewedBy,
      reviewNotes: kyc.reviewNotes,
      rejectionReason: kyc.rejectionReason,
      submittedAt: kyc.submittedAt,
      approvedAt: kyc.approvedAt,
      expiresAt: kyc.expiresAt,
      metadata: kyc.metadata,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }

  private getDefaultProvider(): string {
    return this.configService.get<string>('kyc.provider', 'jumio');
  }

  private generateVerificationId(): string {
    return `kyc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}