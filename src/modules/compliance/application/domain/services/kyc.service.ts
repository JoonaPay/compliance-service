import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '@shared/metrics/metrics.service';
import { KycVerification, KycLevel, KycStatus, DocumentType, RiskAssessment } from '../entities/kyc-verification.entity';
import { KycVerificationRepository } from '../repositories/kyc-verification.repository';
import { SanctionsScreeningService } from './sanctions-screening.service';
import { DocumentVerificationService } from './document-verification.service';

export interface InitiateKycRequest {
  userId: string;
  level: KycLevel;
  provider?: string;
  metadata?: Record<string, any>;
}

export interface UploadDocumentRequest {
  verificationId: string;
  documentType: DocumentType;
  file: Buffer;
  filename: string;
  contentType: string;
}

export interface ReviewKycRequest {
  verificationId: string;
  approve: boolean;
  reviewedBy: string;
  notes?: string;
  rejectionReason?: string;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly kycRepository: KycVerificationRepository,
    private readonly sanctionsService: SanctionsScreeningService,
    private readonly documentService: DocumentVerificationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async initiateKyc(request: InitiateKycRequest): Promise<KycVerification> {
    try {
      this.logger.log(`Initiating KYC verification for user: ${request.userId}, level: ${request.level}`);

      // Check if user already has an active KYC
      const existingKycs = await this.kycRepository.findByUserId(request.userId);
      const existingKyc = existingKycs.find(kyc => kyc.status !== KycStatus.REJECTED && kyc.status !== KycStatus.EXPIRED);
      if (existingKyc && existingKyc.isApproved()) {
        throw new BadRequestException('User already has an approved KYC verification');
      }

      const verificationId = this.generateId();
      const kyc = KycVerification.create({
        id: verificationId,
        userId: request.userId,
        level: request.level,
        provider: request.provider,
        metadata: request.metadata,
      });

      const savedKyc = await this.kycRepository.save(kyc);

      this.eventEmitter.emit('kyc.initiated', {
        verificationId: savedKyc.id,
        userId: savedKyc.userId,
        level: savedKyc.level,
        provider: savedKyc.provider,
      });

      this.metricsService.recordComplianceOperation('kyc_initiated', 'success');
      this.metricsService.incrementKycByStatus('pending');

      this.logger.log(`KYC verification initiated successfully: ${savedKyc.id}`);
      return savedKyc;

    } catch (error) {
      this.logger.error(`Failed to initiate KYC verification: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_initiated', 'failure');
      this.metricsService.recordError('kyc_initiation', 'high');
      throw error;
    }
  }

  async uploadDocument(request: UploadDocumentRequest): Promise<KycVerification> {
    try {
      this.logger.log(`Uploading document for KYC: ${request.verificationId}, type: ${request.documentType}`);

      const kyc = await this.getKycVerification(request.verificationId);

      if (kyc.status === KycStatus.APPROVED || kyc.status === KycStatus.REJECTED) {
        throw new BadRequestException(`Cannot upload documents for ${kyc.status} KYC verification`);
      }

      // Upload and verify document
      const documentResult = await this.documentService.uploadAndVerify({
        file: request.file,
        filename: request.filename,
        contentType: request.contentType,
        documentType: request.documentType,
        verificationId: request.verificationId,
      });

      const document = {
        id: this.generateId(),
        type: request.documentType,
        filename: request.filename,
        url: documentResult.url,
        extractedData: documentResult.extractedData,
        verificationResults: documentResult.verificationResults,
        uploadedAt: new Date(),
      };

      const updatedKyc = kyc.addDocument(document);
      const savedKyc = await this.kycRepository.save(updatedKyc);

      // Check if all required documents are uploaded
      if (savedKyc.hasAllRequiredDocuments()) {
        await this.performRiskAssessment(savedKyc.id);
      }

      this.eventEmitter.emit('kyc.document.uploaded', {
        verificationId: savedKyc.id,
        userId: savedKyc.userId,
        documentType: request.documentType,
        documentId: document.id,
      });

      this.metricsService.recordComplianceOperation('kyc_document_uploaded', 'success');

      this.logger.log(`Document uploaded successfully for KYC: ${savedKyc.id}`);
      return savedKyc;

    } catch (error) {
      this.logger.error(`Failed to upload document for KYC: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_document_uploaded', 'failure');
      this.metricsService.recordError('kyc_document_upload', 'high');
      throw error;
    }
  }

  async performRiskAssessment(verificationId: string): Promise<KycVerification> {
    try {
      this.logger.log(`Performing risk assessment for KYC: ${verificationId}`);

      const kyc = await this.getKycVerification(verificationId);

      if (!kyc.hasAllRequiredDocuments()) {
        throw new BadRequestException('Cannot perform risk assessment without all required documents');
      }

      // Extract personal data from documents for screening
      const personalData = this.extractPersonalDataFromDocuments(kyc);

      // Perform sanctions screening
      const sanctionsResult = await this.sanctionsService.screenIndividual({
        fullName: personalData.fullName,
        dateOfBirth: personalData.dateOfBirth,
        nationality: personalData.nationality,
        address: personalData.address,
      });

      // Calculate risk score based on various factors
      const riskScore = this.calculateRiskScore({
        documentQuality: this.assessDocumentQuality(kyc),
        sanctionsMatch: sanctionsResult.sanctionsMatch,
        pepMatch: sanctionsResult.pepMatch,
        adverseMediaMatch: sanctionsResult.adverseMediaMatch,
        countryRisk: sanctionsResult.countryRisk,
        ageVerification: this.verifyAge(personalData.dateOfBirth),
      });

      const riskAssessment: RiskAssessment = {
        score: riskScore,
        factors: this.getRiskFactors(kyc, sanctionsResult),
        sanctionsMatch: sanctionsResult.sanctionsMatch,
        pepMatch: sanctionsResult.pepMatch,
        adverseMediaMatch: sanctionsResult.adverseMediaMatch,
        countryRisk: sanctionsResult.countryRisk,
        assessedAt: new Date(),
      };

      const updatedKyc = kyc.updateRiskAssessment(riskAssessment);
      const savedKyc = await this.kycRepository.save(updatedKyc);

      this.eventEmitter.emit('kyc.risk.assessed', {
        verificationId: savedKyc.id,
        userId: savedKyc.userId,
        riskScore: riskAssessment.score,
        status: savedKyc.status,
        sanctionsMatch: riskAssessment.sanctionsMatch,
        pepMatch: riskAssessment.pepMatch,
      });

      this.metricsService.recordComplianceOperation('kyc_risk_assessed', 'success');
      this.metricsService.recordRiskScore('kyc', riskAssessment.score);

      this.logger.log(`Risk assessment completed for KYC: ${savedKyc.id}, score: ${riskAssessment.score}`);
      return savedKyc;

    } catch (error) {
      this.logger.error(`Failed to perform risk assessment for KYC: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_risk_assessed', 'failure');
      this.metricsService.recordError('kyc_risk_assessment', 'high');
      throw error;
    }
  }

  async reviewKyc(request: ReviewKycRequest): Promise<KycVerification> {
    try {
      this.logger.log(`Manual review for KYC: ${request.verificationId} by ${request.reviewedBy}`);

      const kyc = await this.getKycVerification(request.verificationId);

      if (kyc.status !== KycStatus.REQUIRES_MANUAL_REVIEW && kyc.status !== KycStatus.IN_PROGRESS) {
        throw new BadRequestException(`Cannot review KYC in status: ${kyc.status}`);
      }

      let updatedKyc: KycVerification;

      if (request.approve) {
        updatedKyc = kyc.updateStatus(KycStatus.APPROVED, request.reviewedBy, request.notes);
      } else {
        updatedKyc = kyc.reject(request.rejectionReason!, request.reviewedBy);
      }

      const savedKyc = await this.kycRepository.save(updatedKyc);

      this.eventEmitter.emit('kyc.reviewed', {
        verificationId: savedKyc.id,
        userId: savedKyc.userId,
        approved: request.approve,
        reviewedBy: request.reviewedBy,
        status: savedKyc.status,
      });

      this.metricsService.recordComplianceOperation('kyc_reviewed', 'success');
      this.metricsService.updateKycStatusMetrics(kyc.status, savedKyc.status);

      this.logger.log(`KYC review completed: ${savedKyc.id}, approved: ${request.approve}`);
      return savedKyc;

    } catch (error) {
      this.logger.error(`Failed to review KYC: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyc_reviewed', 'failure');
      this.metricsService.recordError('kyc_review', 'high');
      throw error;
    }
  }

  async getKycVerification(verificationId: string): Promise<KycVerification> {
    const kyc = await this.kycRepository.findById(verificationId);
    if (!kyc) {
      throw new NotFoundException(`KYC verification not found: ${verificationId}`);
    }
    return kyc;
  }

  async getUserKycVerifications(userId: string): Promise<KycVerification[]> {
    return this.kycRepository.findByUserId(userId);
  }

  async getKycsByStatus(status: KycStatus, page = 1, limit = 50): Promise<{ items: KycVerification[]; total: number }> {
    const items = await this.kycRepository.findByStatus(status);
    return { items, total: items.length };
  }

  async checkExpiredKycs(): Promise<void> {
    try {
      this.logger.log('Checking for expired KYC verifications');

      const expiredKycs = await this.kycRepository.findExpired(30);
      
      for (const kyc of expiredKycs) {
        const updatedKyc = kyc.updateStatus(KycStatus.EXPIRED);
        await this.kycRepository.save(updatedKyc);

        this.eventEmitter.emit('kyc.expired', {
          verificationId: kyc.id,
          userId: kyc.userId,
          expiredAt: kyc.expiresAt,
        });

        this.metricsService.updateKycStatusMetrics(kyc.status, KycStatus.EXPIRED);
      }

      this.logger.log(`Processed ${expiredKycs.length} expired KYC verifications`);

    } catch (error) {
      this.logger.error(`Failed to check expired KYCs: ${error.message}`, error.stack);
      this.metricsService.recordError('kyc_expiry_check', 'medium');
    }
  }

  private extractPersonalDataFromDocuments(kyc: KycVerification): any {
    // Extract and combine personal data from all uploaded documents
    const extractedData: any = {};
    
    kyc.documents.forEach(doc => {
      if (doc.extractedData) {
        Object.assign(extractedData, doc.extractedData);
      }
    });

    return {
      fullName: extractedData.fullName || extractedData.name,
      dateOfBirth: extractedData.dateOfBirth ? new Date(extractedData.dateOfBirth) : undefined,
      nationality: extractedData.nationality || extractedData.country,
      address: extractedData.address,
    };
  }

  private calculateRiskScore(factors: any): number {
    let score = 1.0;

    // Deduct for poor document quality
    if (factors.documentQuality < 0.8) {
      score -= 0.2;
    }

    // Deduct for sanctions/PEP matches
    if (factors.sanctionsMatch) score -= 0.5;
    if (factors.pepMatch) score -= 0.3;
    if (factors.adverseMediaMatch) score -= 0.2;

    // Deduct for high country risk
    score -= factors.countryRisk * 0.3;

    // Deduct for age verification issues
    if (!factors.ageVerification) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private assessDocumentQuality(kyc: KycVerification): number {
    // Assess overall document quality based on verification results
    const scores = kyc.documents.map(doc => {
      if (!doc.verificationResults) return 0.5;
      
      const results = doc.verificationResults;
      let docScore = 1.0;

      if (results.imageQuality < 0.8) docScore -= 0.2;
      if (results.documentAuthenticity < 0.9) docScore -= 0.3;
      if (results.faceMatch < 0.8) docScore -= 0.2;

      return Math.max(0, docScore);
    });

    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.5;
  }

  private verifyAge(dateOfBirth?: Date): boolean {
    if (!dateOfBirth) return false;
    
    const age = Math.floor((Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 18; // Minimum age requirement
  }

  private getRiskFactors(kyc: KycVerification, sanctionsResult: any): string[] {
    const factors: string[] = [];

    if (sanctionsResult.sanctionsMatch) factors.push('sanctions_match');
    if (sanctionsResult.pepMatch) factors.push('pep_match');
    if (sanctionsResult.adverseMediaMatch) factors.push('adverse_media_match');
    if (sanctionsResult.countryRisk > 0.7) factors.push('high_country_risk');
    if (this.assessDocumentQuality(kyc) < 0.8) factors.push('poor_document_quality');

    return factors;
  }

  private generateId(): string {
    return `kyc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}