import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '@shared/metrics/metrics.service';
import { 
  KybVerification, 
  KybStatus, 
  BusinessType, 
  BusinessDocumentType, 
  BusinessDetails,
  BusinessRiskAssessment,
  UltimateBeificialOwner 
} from '../entities/kyb-verification.entity';
import { KybVerificationRepository } from '../repositories/kyb-verification.repository';
import { SanctionsScreeningService } from './sanctions-screening.service';
import { DocumentVerificationService } from './document-verification.service';

export interface InitiateKybRequest {
  businessId: string;
  businessDetails: BusinessDetails;
  provider?: string;
  metadata?: Record<string, any>;
}

export interface UploadBusinessDocumentRequest {
  verificationId: string;
  documentType: BusinessDocumentType;
  file: Buffer;
  filename: string;
  contentType: string;
}

export interface AddUboRequest {
  verificationId: string;
  ubo: Omit<UltimateBeificialOwner, 'id'>;
}

export interface ReviewKybRequest {
  verificationId: string;
  approve: boolean;
  reviewedBy: string;
  notes?: string;
  rejectionReason?: string;
}

@Injectable()
export class KybService {
  private readonly logger = new Logger(KybService.name);

  constructor(
    private readonly kybRepository: KybVerificationRepository,
    private readonly sanctionsService: SanctionsScreeningService,
    private readonly documentService: DocumentVerificationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  async initiateKyb(request: InitiateKybRequest): Promise<KybVerification> {
    try {
      this.logger.log(`Initiating KYB verification for business: ${request.businessId}`);

      // Check if business already has an active KYB
      const existingKybs = await this.kybRepository.findByBusinessId(request.businessId);
      const existingKyb = existingKybs.find(kyb => kyb.status !== KybStatus.REJECTED && kyb.status !== KybStatus.EXPIRED);
      if (existingKyb && existingKyb.isApproved()) {
        throw new BadRequestException('Business already has an approved KYB verification');
      }

      const verificationId = this.generateId();
      const kyb = KybVerification.create({
        id: verificationId,
        businessId: request.businessId,
        businessDetails: request.businessDetails,
        provider: request.provider,
        metadata: request.metadata,
      });

      const savedKyb = await this.kybRepository.save(kyb);

      this.eventEmitter.emit('kyb.initiated', {
        verificationId: savedKyb.id,
        businessId: savedKyb.businessId,
        businessName: savedKyb.businessDetails.name,
        businessType: savedKyb.businessDetails.type,
        provider: savedKyb.provider,
      });

      this.metricsService.recordComplianceOperation('kyb_initiated', 'success');
      this.metricsService.incrementKybByStatus('pending');

      this.logger.log(`KYB verification initiated successfully: ${savedKyb.id}`);
      return savedKyb;

    } catch (error) {
      this.logger.error(`Failed to initiate KYB verification: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyb_initiated', 'failure');
      this.metricsService.recordError('kyb_initiation', 'high');
      throw error;
    }
  }

  async uploadBusinessDocument(request: UploadBusinessDocumentRequest): Promise<KybVerification> {
    try {
      this.logger.log(`Uploading business document for KYB: ${request.verificationId}, type: ${request.documentType}`);

      const kyb = await this.getKybVerification(request.verificationId);

      if (kyb.status === KybStatus.APPROVED || kyb.status === KybStatus.REJECTED) {
        throw new BadRequestException(`Cannot upload documents for ${kyb.status} KYB verification`);
      }

      // Upload and verify business document
      const documentResult = await this.documentService.uploadAndVerifyBusinessDocument({
        file: request.file,
        filename: request.filename,
        contentType: request.contentType,
        documentType: request.documentType,
        verificationId: request.verificationId,
        businessDetails: kyb.businessDetails,
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

      const updatedKyb = kyb.addDocument(document);
      const savedKyb = await this.kybRepository.save(updatedKyb);

      this.eventEmitter.emit('kyb.document.uploaded', {
        verificationId: savedKyb.id,
        businessId: savedKyb.businessId,
        documentType: request.documentType,
        documentId: document.id,
      });

      this.metricsService.recordComplianceOperation('kyb_document_uploaded', 'success');

      this.logger.log(`Business document uploaded successfully for KYB: ${savedKyb.id}`);
      return savedKyb;

    } catch (error) {
      this.logger.error(`Failed to upload business document for KYB: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyb_document_uploaded', 'failure');
      this.metricsService.recordError('kyb_document_upload', 'high');
      throw error;
    }
  }

  async addUbo(request: AddUboRequest): Promise<KybVerification> {
    try {
      this.logger.log(`Adding UBO for KYB: ${request.verificationId}`);

      const kyb = await this.getKybVerification(request.verificationId);

      if (kyb.status === KybStatus.APPROVED || kyb.status === KybStatus.REJECTED) {
        throw new BadRequestException(`Cannot add UBO for ${kyb.status} KYB verification`);
      }

      // Validate UBO data
      this.validateUboData(request.ubo, kyb);

      const ubo: UltimateBeificialOwner = {
        id: this.generateId(),
        ...request.ubo,
      };

      const updatedKyb = kyb.addUBO(ubo);
      const savedKyb = await this.kybRepository.save(updatedKyb);

      // Check if ready for risk assessment
      if (savedKyb.isReadyForSubmission()) {
        await this.performBusinessRiskAssessment(savedKyb.id);
      }

      this.eventEmitter.emit('kyb.ubo.added', {
        verificationId: savedKyb.id,
        businessId: savedKyb.businessId,
        uboId: ubo.id,
        uboName: ubo.name,
        ownershipPercentage: ubo.ownershipPercentage,
      });

      this.metricsService.recordComplianceOperation('kyb_ubo_added', 'success');

      this.logger.log(`UBO added successfully for KYB: ${savedKyb.id}`);
      return savedKyb;

    } catch (error) {
      this.logger.error(`Failed to add UBO for KYB: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyb_ubo_added', 'failure');
      this.metricsService.recordError('kyb_ubo_addition', 'high');
      throw error;
    }
  }

  async performBusinessRiskAssessment(verificationId: string): Promise<KybVerification> {
    try {
      this.logger.log(`Performing business risk assessment for KYB: ${verificationId}`);

      const kyb = await this.getKybVerification(verificationId);

      if (!kyb.isReadyForSubmission()) {
        throw new BadRequestException('Cannot perform risk assessment - missing required documents or UBOs');
      }

      // Screen business against sanctions lists
      const businessScreeningResult = await this.sanctionsService.screenBusiness({
        businessName: kyb.businessDetails.name,
        registrationNumber: kyb.businessDetails.registrationNumber,
        taxId: kyb.businessDetails.taxId,
        incorporationCountry: kyb.businessDetails.incorporationCountry,
        address: kyb.businessDetails.registeredAddress,
      });

      // Screen all UBOs
      const uboRiskScores: { [uboId: string]: number } = {};
      for (const ubo of kyb.ultimateBeneficialOwners) {
        const uboScreeningResult = await this.sanctionsService.screenIndividual({
          fullName: ubo.name,
          dateOfBirth: ubo.dateOfBirth,
          nationality: ubo.nationality,
          address: ubo.address,
        });

        uboRiskScores[ubo.id] = this.calculateUboRiskScore(uboScreeningResult, ubo);
      }

      // Calculate overall business risk score
      const businessRiskScore = this.calculateBusinessRiskScore({
        businessScreening: businessScreeningResult,
        uboRiskScores,
        businessDetails: kyb.businessDetails,
        documentQuality: this.assessBusinessDocumentQuality(kyb),
      });

      const riskAssessment: BusinessRiskAssessment = {
        score: businessRiskScore,
        factors: this.getBusinessRiskFactors(kyb, businessScreeningResult),
        sanctionsMatch: businessScreeningResult.sanctionsMatch,
        adverseMediaMatch: businessScreeningResult.adverseMediaMatch,
        jurisdictionRisk: businessScreeningResult.jurisdictionRisk,
        industryRisk: this.calculateIndustryRisk(kyb.businessDetails.industry),
        uboRiskScores,
        assessedAt: new Date(),
      };

      const updatedKyb = kyb.updateRiskAssessment(riskAssessment);
      const savedKyb = await this.kybRepository.save(updatedKyb);

      this.eventEmitter.emit('kyb.risk.assessed', {
        verificationId: savedKyb.id,
        businessId: savedKyb.businessId,
        riskScore: riskAssessment.score,
        status: savedKyb.status,
        sanctionsMatch: riskAssessment.sanctionsMatch,
        highRiskUbos: Object.entries(uboRiskScores).filter(([_, score]) => score < 0.5).length,
      });

      this.metricsService.recordComplianceOperation('kyb_risk_assessed', 'success');
      this.metricsService.recordRiskScore('kyb', riskAssessment.score);

      this.logger.log(`Business risk assessment completed for KYB: ${savedKyb.id}, score: ${riskAssessment.score}`);
      return savedKyb;

    } catch (error) {
      this.logger.error(`Failed to perform business risk assessment for KYB: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyb_risk_assessed', 'failure');
      this.metricsService.recordError('kyb_risk_assessment', 'high');
      throw error;
    }
  }

  async reviewKyb(request: ReviewKybRequest): Promise<KybVerification> {
    try {
      this.logger.log(`Manual review for KYB: ${request.verificationId} by ${request.reviewedBy}`);

      const kyb = await this.getKybVerification(request.verificationId);

      if (kyb.status !== KybStatus.REQUIRES_MANUAL_REVIEW && kyb.status !== KybStatus.IN_PROGRESS) {
        throw new BadRequestException(`Cannot review KYB in status: ${kyb.status}`);
      }

      let updatedKyb: KybVerification;

      if (request.approve) {
        updatedKyb = kyb.updateStatus(KybStatus.APPROVED, request.reviewedBy, request.notes);
      } else {
        updatedKyb = kyb.reject(request.rejectionReason!, request.reviewedBy);
      }

      const savedKyb = await this.kybRepository.save(updatedKyb);

      this.eventEmitter.emit('kyb.reviewed', {
        verificationId: savedKyb.id,
        businessId: savedKyb.businessId,
        approved: request.approve,
        reviewedBy: request.reviewedBy,
        status: savedKyb.status,
      });

      this.metricsService.recordComplianceOperation('kyb_reviewed', 'success');
      this.metricsService.updateKybStatusMetrics(kyb.status, savedKyb.status);

      this.logger.log(`KYB review completed: ${savedKyb.id}, approved: ${request.approve}`);
      return savedKyb;

    } catch (error) {
      this.logger.error(`Failed to review KYB: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('kyb_reviewed', 'failure');
      this.metricsService.recordError('kyb_review', 'high');
      throw error;
    }
  }

  async getKybVerification(verificationId: string): Promise<KybVerification> {
    const kyb = await this.kybRepository.findById(verificationId);
    if (!kyb) {
      throw new NotFoundException(`KYB verification not found: ${verificationId}`);
    }
    return kyb;
  }

  async getBusinessKybVerifications(businessId: string): Promise<KybVerification[]> {
    return this.kybRepository.findByBusinessId(businessId);
  }

  async getKybsByStatus(status: KybStatus, page = 1, limit = 50): Promise<{ items: KybVerification[]; total: number }> {
    const items = await this.kybRepository.findByStatus(status);
    return { items, total: items.length };
  }

  async checkExpiredKybs(): Promise<void> {
    try {
      this.logger.log('Checking for expired KYB verifications');

      const expiredKybs = await this.kybRepository.findExpired(30);
      
      for (const kyb of expiredKybs) {
        const updatedKyb = kyb.updateStatus(KybStatus.EXPIRED);
        await this.kybRepository.save(updatedKyb);

        this.eventEmitter.emit('kyb.expired', {
          verificationId: kyb.id,
          businessId: kyb.businessId,
          expiredAt: kyb.expiresAt,
        });

        this.metricsService.updateKybStatusMetrics(kyb.status, KybStatus.EXPIRED);
      }

      this.logger.log(`Processed ${expiredKybs.length} expired KYB verifications`);

    } catch (error) {
      this.logger.error(`Failed to check expired KYBs: ${error.message}`, error.stack);
      this.metricsService.recordError('kyb_expiry_check', 'medium');
    }
  }

  private validateUboData(ubo: Omit<UltimateBeificialOwner, 'id'>, kyb: KybVerification): void {
    if (ubo.ownershipPercentage <= 0 || ubo.ownershipPercentage > 100) {
      throw new BadRequestException('UBO ownership percentage must be between 0 and 100');
    }

    const totalOwnership = kyb.getTotalOwnershipPercentage() + ubo.ownershipPercentage;
    if (totalOwnership > 100) {
      throw new BadRequestException('Total UBO ownership cannot exceed 100%');
    }

    if (!ubo.name || ubo.name.trim().length === 0) {
      throw new BadRequestException('UBO name is required');
    }
  }

  private calculateUboRiskScore(screeningResult: any, ubo: UltimateBeificialOwner): number {
    let score = 1.0;

    // Deduct for sanctions/PEP matches
    if (screeningResult.sanctionsMatch) score -= 0.6;
    if (screeningResult.pepMatch) score -= 0.4;
    if (screeningResult.adverseMediaMatch) score -= 0.2;

    // Deduct for high country risk
    score -= screeningResult.countryRisk * 0.3;

    // Deduct for high ownership without proper documentation
    if (ubo.ownershipPercentage > 25 && !ubo.kycStatus) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateBusinessRiskScore(factors: any): number {
    let score = 1.0;

    // Business-level risk factors
    if (factors.businessScreening.sanctionsMatch) score -= 0.5;
    if (factors.businessScreening.adverseMediaMatch) score -= 0.3;

    // Jurisdiction and industry risk
    score -= factors.businessScreening.jurisdictionRisk * 0.2;
    score -= factors.industryRisk * 0.2;

    // Document quality
    if (factors.documentQuality < 0.8) score -= 0.2;

    // UBO risk aggregation
    const uboScores = Object.values(factors.uboRiskScores) as number[];
    if (uboScores.length > 0) {
      const avgUboRisk = uboScores.reduce((sum, s) => sum + s, 0) / uboScores.length;
      const lowRiskUboCount = uboScores.filter(s => s < 0.5).length;
      
      // Deduct more if multiple UBOs are high risk
      score -= (1 - avgUboRisk) * 0.3;
      if (lowRiskUboCount > 0) {
        score -= lowRiskUboCount * 0.1;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateIndustryRisk(industry?: string): number {
    const highRiskIndustries = [
      'cryptocurrency', 'gambling', 'adult_entertainment', 'pawn_shops',
      'money_services', 'precious_metals', 'cannabis', 'arms_dealing'
    ];

    const mediumRiskIndustries = [
      'real_estate', 'art_dealers', 'jewelry', 'automotive_dealers',
      'construction', 'import_export'
    ];

    if (!industry) return 0.3; // Unknown industry has medium risk

    const lowerIndustry = industry.toLowerCase();
    
    if (highRiskIndustries.some(risk => lowerIndustry.includes(risk))) {
      return 0.8;
    }
    
    if (mediumRiskIndustries.some(risk => lowerIndustry.includes(risk))) {
      return 0.5;
    }

    return 0.2; // Low risk for other industries
  }

  private assessBusinessDocumentQuality(kyb: KybVerification): number {
    if (kyb.documents.length === 0) return 0;

    const scores = kyb.documents.map(doc => {
      if (!doc.verificationResults) return 0.5;
      
      const results = doc.verificationResults;
      let docScore = 1.0;

      if (results.imageQuality < 0.8) docScore -= 0.2;
      if (results.documentAuthenticity < 0.9) docScore -= 0.3;
      if (results.dataExtraction < 0.8) docScore -= 0.2;

      return Math.max(0, docScore);
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private getBusinessRiskFactors(kyb: KybVerification, screeningResult: any): string[] {
    const factors: string[] = [];

    if (screeningResult.sanctionsMatch) factors.push('business_sanctions_match');
    if (screeningResult.adverseMediaMatch) factors.push('business_adverse_media');
    if (screeningResult.jurisdictionRisk > 0.7) factors.push('high_jurisdiction_risk');
    if (this.calculateIndustryRisk(kyb.businessDetails.industry) > 0.6) factors.push('high_industry_risk');
    if (this.assessBusinessDocumentQuality(kyb) < 0.8) factors.push('poor_document_quality');
    if (kyb.ultimateBeneficialOwners.length === 0) factors.push('missing_ubo_information');
    if (kyb.getTotalOwnershipPercentage() < 75) factors.push('incomplete_ownership_structure');

    return factors;
  }

  private generateId(): string {
    return `kyb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}