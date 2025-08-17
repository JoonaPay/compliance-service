export enum KybStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REQUIRES_MANUAL_REVIEW = 'requires_manual_review',
}

export enum BusinessType {
  SOLE_PROPRIETORSHIP = 'sole_proprietorship',
  PARTNERSHIP = 'partnership',
  LIMITED_LIABILITY_COMPANY = 'limited_liability_company',
  CORPORATION = 'corporation',
  NON_PROFIT = 'non_profit',
  GOVERNMENT_ENTITY = 'government_entity',
  TRUST = 'trust',
  OTHER = 'other',
}

export enum BusinessDocumentType {
  CERTIFICATE_OF_INCORPORATION = 'certificate_of_incorporation',
  BUSINESS_LICENSE = 'business_license',
  TAX_REGISTRATION = 'tax_registration',
  MEMORANDUM_OF_ASSOCIATION = 'memorandum_of_association',
  ARTICLES_OF_ASSOCIATION = 'articles_of_association',
  SHAREHOLDERS_REGISTER = 'shareholders_register',
  DIRECTORS_REGISTER = 'directors_register',
  BANK_STATEMENT = 'bank_statement',
  UTILITY_BILL = 'utility_bill',
  LEASE_AGREEMENT = 'lease_agreement',
  UBO_DECLARATION = 'ubo_declaration',
}

export interface BusinessDocument {
  id: string;
  type: BusinessDocumentType;
  filename: string;
  url: string;
  extractedData?: Record<string, any>;
  verificationResults?: Record<string, any>;
  uploadedAt: Date;
}

export interface UltimateBeificialOwner {
  id: string;
  name: string;
  ownershipPercentage: number;
  dateOfBirth?: Date;
  nationality?: string;
  address?: string;
  kycStatus?: string;
  sanctionsMatch?: boolean;
  pepMatch?: boolean;
}

export interface BusinessDetails {
  name: string;
  registrationNumber?: string;
  taxId?: string;
  type: BusinessType;
  industry?: string;
  description?: string;
  website?: string;
  registeredAddress?: string;
  operatingAddress?: string;
  incorporationDate?: Date;
  incorporationCountry?: string;
  phoneNumber?: string;
  email?: string;
}

export interface BusinessRiskAssessment {
  score: number; // 0-1 scale
  factors: string[];
  sanctionsMatch: boolean;
  adverseMediaMatch: boolean;
  jurisdictionRisk: number;
  industryRisk: number;
  uboRiskScores: { [uboId: string]: number };
  assessedAt: Date;
}

export class KybVerification {
  constructor(
    public readonly id: string,
    public readonly businessId: string,
    public readonly businessDetails: BusinessDetails,
    public readonly status: KybStatus,
    public readonly documents: BusinessDocument[],
    public readonly ultimateBeneficialOwners: UltimateBeificialOwner[],
    public readonly riskAssessment?: BusinessRiskAssessment,
    public readonly provider?: string,
    public readonly providerReference?: string,
    public readonly reviewedBy?: string,
    public readonly reviewNotes?: string,
    public readonly rejectionReason?: string,
    public readonly submittedAt?: Date,
    public readonly approvedAt?: Date,
    public readonly expiresAt?: Date,
    public readonly metadata?: Record<string, any>,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}

  static create(data: {
    id: string;
    businessId: string;
    businessDetails: BusinessDetails;
    provider?: string;
    metadata?: Record<string, any>;
  }): KybVerification {
    return new KybVerification(
      data.id,
      data.businessId,
      data.businessDetails,
      KybStatus.PENDING,
      [],
      [],
      undefined,
      data.provider,
      undefined,
      undefined,
      undefined,
      undefined,
      new Date(),
      undefined,
      undefined,
      data.metadata,
      new Date(),
      new Date(),
    );
  }

  updateStatus(newStatus: KybStatus, reviewedBy?: string, notes?: string): KybVerification {
    return new KybVerification(
      this.id,
      this.businessId,
      this.businessDetails,
      newStatus,
      this.documents,
      this.ultimateBeneficialOwners,
      this.riskAssessment,
      this.provider,
      this.providerReference,
      reviewedBy || this.reviewedBy,
      notes || this.reviewNotes,
      this.rejectionReason,
      this.submittedAt,
      newStatus === KybStatus.APPROVED ? new Date() : this.approvedAt,
      this.calculateExpiryDate(newStatus),
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  updateBusinessDetails(businessDetails: BusinessDetails): KybVerification {
    return new KybVerification(
      this.id,
      this.businessId,
      businessDetails,
      this.status,
      this.documents,
      this.ultimateBeneficialOwners,
      this.riskAssessment,
      this.provider,
      this.providerReference,
      this.reviewedBy,
      this.reviewNotes,
      this.rejectionReason,
      this.submittedAt,
      this.approvedAt,
      this.expiresAt,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  addDocument(document: BusinessDocument): KybVerification {
    const updatedDocuments = [...this.documents, document];
    const newStatus = this.shouldUpdateStatusAfterDocument() ? KybStatus.IN_PROGRESS : this.status;

    return new KybVerification(
      this.id,
      this.businessId,
      this.businessDetails,
      newStatus,
      updatedDocuments,
      this.ultimateBeneficialOwners,
      this.riskAssessment,
      this.provider,
      this.providerReference,
      this.reviewedBy,
      this.reviewNotes,
      this.rejectionReason,
      newStatus === KybStatus.IN_PROGRESS && !this.submittedAt ? new Date() : this.submittedAt,
      this.approvedAt,
      this.expiresAt,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  addUBO(ubo: UltimateBeificialOwner): KybVerification {
    const updatedUBOs = [...this.ultimateBeneficialOwners, ubo];

    return new KybVerification(
      this.id,
      this.businessId,
      this.businessDetails,
      this.status,
      this.documents,
      updatedUBOs,
      this.riskAssessment,
      this.provider,
      this.providerReference,
      this.reviewedBy,
      this.reviewNotes,
      this.rejectionReason,
      this.submittedAt,
      this.approvedAt,
      this.expiresAt,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  updateRiskAssessment(riskAssessment: BusinessRiskAssessment): KybVerification {
    const newStatus = this.determineStatusFromRisk(riskAssessment);

    return new KybVerification(
      this.id,
      this.businessId,
      this.businessDetails,
      newStatus,
      this.documents,
      this.ultimateBeneficialOwners,
      riskAssessment,
      this.provider,
      this.providerReference,
      this.reviewedBy,
      this.reviewNotes,
      this.rejectionReason,
      this.submittedAt,
      newStatus === KybStatus.APPROVED ? new Date() : this.approvedAt,
      this.calculateExpiryDate(newStatus),
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  reject(reason: string, reviewedBy?: string): KybVerification {
    return new KybVerification(
      this.id,
      this.businessId,
      this.businessDetails,
      KybStatus.REJECTED,
      this.documents,
      this.ultimateBeneficialOwners,
      this.riskAssessment,
      this.provider,
      this.providerReference,
      reviewedBy || this.reviewedBy,
      this.reviewNotes,
      reason,
      this.submittedAt,
      this.approvedAt,
      this.expiresAt,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  isApproved(): boolean {
    return this.status === KybStatus.APPROVED && !this.isExpired();
  }

  canBeAutoApproved(threshold: number = 0.95): boolean {
    if (!this.riskAssessment) return false;
    
    const allUBOsLowRisk = Object.values(this.riskAssessment.uboRiskScores).every(score => score >= threshold);
    
    return this.riskAssessment.score >= threshold && 
           !this.riskAssessment.sanctionsMatch && 
           allUBOsLowRisk;
  }

  requiresManualReview(threshold: number = 0.5): boolean {
    if (!this.riskAssessment) return true;
    
    const hasHighRiskUBO = Object.values(this.riskAssessment.uboRiskScores).some(score => score < threshold);
    
    return this.riskAssessment.score < threshold || 
           this.riskAssessment.sanctionsMatch || 
           this.riskAssessment.adverseMediaMatch ||
           hasHighRiskUBO;
  }

  getRequiredDocuments(): BusinessDocumentType[] {
    const baseDocuments = [
      BusinessDocumentType.CERTIFICATE_OF_INCORPORATION,
      BusinessDocumentType.BUSINESS_LICENSE,
      BusinessDocumentType.TAX_REGISTRATION,
      BusinessDocumentType.BANK_STATEMENT,
      BusinessDocumentType.UBO_DECLARATION,
    ];

    switch (this.businessDetails.type) {
      case BusinessType.CORPORATION:
        return [
          ...baseDocuments,
          BusinessDocumentType.MEMORANDUM_OF_ASSOCIATION,
          BusinessDocumentType.ARTICLES_OF_ASSOCIATION,
          BusinessDocumentType.SHAREHOLDERS_REGISTER,
          BusinessDocumentType.DIRECTORS_REGISTER,
        ];
      case BusinessType.LIMITED_LIABILITY_COMPANY:
        return [
          ...baseDocuments,
          BusinessDocumentType.MEMORANDUM_OF_ASSOCIATION,
        ];
      default:
        return baseDocuments;
    }
  }

  hasAllRequiredDocuments(): boolean {
    const required = this.getRequiredDocuments();
    const provided = this.documents.map(doc => doc.type);
    
    return required.every(type => provided.includes(type));
  }

  hasRequiredUBOs(): boolean {
    // At least one UBO with ownership > 25%
    return this.ultimateBeneficialOwners.some(ubo => ubo.ownershipPercentage > 25);
  }

  getTotalOwnershipPercentage(): number {
    return this.ultimateBeneficialOwners.reduce((total, ubo) => total + ubo.ownershipPercentage, 0);
  }

  isReadyForSubmission(): boolean {
    return this.hasAllRequiredDocuments() && 
           this.hasRequiredUBOs() && 
           this.getTotalOwnershipPercentage() >= 75;
  }

  private shouldUpdateStatusAfterDocument(): boolean {
    return this.status === KybStatus.PENDING && this.documents.length === 0;
  }

  private determineStatusFromRisk(riskAssessment: BusinessRiskAssessment): KybStatus {
    if (this.canBeAutoApproved()) {
      return KybStatus.APPROVED;
    }
    
    if (this.requiresManualReview()) {
      return KybStatus.REQUIRES_MANUAL_REVIEW;
    }
    
    return this.status;
  }

  private calculateExpiryDate(status: KybStatus): Date | undefined {
    if (status === KybStatus.APPROVED) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 2 years validity for KYB
      return expiryDate;
    }
    return this.expiresAt;
  }

  toJSON() {
    return {
      id: this.id,
      businessId: this.businessId,
      businessDetails: this.businessDetails,
      status: this.status,
      documents: this.documents,
      ultimateBeneficialOwners: this.ultimateBeneficialOwners,
      riskAssessment: this.riskAssessment,
      provider: this.provider,
      providerReference: this.providerReference,
      reviewedBy: this.reviewedBy,
      reviewNotes: this.reviewNotes,
      rejectionReason: this.rejectionReason,
      submittedAt: this.submittedAt,
      approvedAt: this.approvedAt,
      expiresAt: this.expiresAt,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}