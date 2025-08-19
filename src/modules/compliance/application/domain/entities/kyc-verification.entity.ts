export enum KycStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REQUIRES_MANUAL_REVIEW = 'requires_manual_review',
}

export enum KycLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  ENHANCED = 'enhanced',
}

export enum DocumentType {
  PASSPORT = 'passport',
  DRIVER_LICENSE = 'driver_license',
  NATIONAL_ID = 'national_id',
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  SELFIE = 'selfie',
  VIDEO_SELFIE = 'video_selfie',
}

export enum BusinessDocumentType {
  CERTIFICATE_OF_INCORPORATION = 'certificate_of_incorporation',
  ARTICLES_OF_INCORPORATION = 'articles_of_incorporation',
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
  PROOF_OF_ADDRESS = 'proof_of_address',
  BANK_REFERENCE = 'bank_reference',
  FINANCIAL_STATEMENTS = 'financial_statements',
  BOARD_RESOLUTION = 'board_resolution',
  POWER_OF_ATTORNEY = 'power_of_attorney',
  GOOD_STANDING_CERTIFICATE = 'good_standing_certificate',
  OTHER = 'other',
}

export interface BusinessDetails {
  name: string;
  registrationNumber: string;
  incorporationDate: Date;
  registeredAddress: string;
  businessType: string;
  industry: string;
  website?: string;
  phone?: string;
  email?: string;
  directors: Array<{
    name: string;
    position: string;
    nationality: string;
    dateOfBirth: Date;
  }>;
  shareholders: Array<{
    name: string;
    ownershipPercentage: number;
    nationality: string;
  }>;
}

export interface KycDocument {
  id: string;
  type: DocumentType;
  filename: string;
  url: string;
  extractedData?: Record<string, any>;
  verificationResults?: Record<string, any>;
  uploadedAt: Date;
}

export interface RiskAssessment {
  score: number; // 0-1 scale
  factors: string[];
  sanctionsMatch: boolean;
  pepMatch: boolean;
  adverseMediaMatch: boolean;
  countryRisk: number;
  assessedAt: Date;
}

export class KycVerification {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly level: KycLevel,
    public readonly status: KycStatus,
    public readonly documents: KycDocument[],
    public readonly riskAssessment?: RiskAssessment,
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
    userId: string;
    level: KycLevel;
    provider?: string;
    metadata?: Record<string, any>;
  }): KycVerification {
    return new KycVerification(
      data.id,
      data.userId,
      data.level,
      KycStatus.PENDING,
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

  updateStatus(newStatus: KycStatus, reviewedBy?: string, notes?: string): KycVerification {
    return new KycVerification(
      this.id,
      this.userId,
      this.level,
      newStatus,
      this.documents,
      this.riskAssessment,
      this.provider,
      this.providerReference,
      reviewedBy || this.reviewedBy,
      notes || this.reviewNotes,
      this.rejectionReason,
      this.submittedAt,
      newStatus === KycStatus.APPROVED ? new Date() : this.approvedAt,
      this.calculateExpiryDate(newStatus),
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  addDocument(document: KycDocument): KycVerification {
    const updatedDocuments = [...this.documents, document];
    const newStatus = this.shouldUpdateStatusAfterDocument() ? KycStatus.IN_PROGRESS : this.status;

    return new KycVerification(
      this.id,
      this.userId,
      this.level,
      newStatus,
      updatedDocuments,
      this.riskAssessment,
      this.provider,
      this.providerReference,
      this.reviewedBy,
      this.reviewNotes,
      this.rejectionReason,
      newStatus === KycStatus.IN_PROGRESS && !this.submittedAt ? new Date() : this.submittedAt,
      this.approvedAt,
      this.expiresAt,
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  updateRiskAssessment(riskAssessment: RiskAssessment): KycVerification {
    const newStatus = this.determineStatusFromRisk(riskAssessment);

    return new KycVerification(
      this.id,
      this.userId,
      this.level,
      newStatus,
      this.documents,
      riskAssessment,
      this.provider,
      this.providerReference,
      this.reviewedBy,
      this.reviewNotes,
      this.rejectionReason,
      this.submittedAt,
      newStatus === KycStatus.APPROVED ? new Date() : this.approvedAt,
      this.calculateExpiryDate(newStatus),
      this.metadata,
      this.createdAt,
      new Date(),
    );
  }

  reject(reason: string, reviewedBy?: string): KycVerification {
    return new KycVerification(
      this.id,
      this.userId,
      this.level,
      KycStatus.REJECTED,
      this.documents,
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
    return this.status === KycStatus.APPROVED && !this.isExpired();
  }

  canBeAutoApproved(threshold: number = 0.95): boolean {
    return this.riskAssessment 
      ? this.riskAssessment.score >= threshold && !this.riskAssessment.sanctionsMatch && !this.riskAssessment.pepMatch
      : false;
  }

  requiresManualReview(threshold: number = 0.5): boolean {
    if (!this.riskAssessment) return true;
    
    return this.riskAssessment.score < threshold || 
           this.riskAssessment.sanctionsMatch || 
           this.riskAssessment.pepMatch ||
           this.riskAssessment.adverseMediaMatch;
  }

  getRequiredDocuments(): DocumentType[] {
    switch (this.level) {
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

  hasAllRequiredDocuments(): boolean {
    const required = this.getRequiredDocuments();
    const provided = this.documents.map(doc => doc.type);
    
    return required.every(type => provided.includes(type));
  }

  private shouldUpdateStatusAfterDocument(): boolean {
    return this.status === KycStatus.PENDING && this.documents.length === 0;
  }

  private determineStatusFromRisk(riskAssessment: RiskAssessment): KycStatus {
    if (this.canBeAutoApproved()) {
      return KycStatus.APPROVED;
    }
    
    if (this.requiresManualReview()) {
      return KycStatus.REQUIRES_MANUAL_REVIEW;
    }
    
    return this.status;
  }

  private calculateExpiryDate(status: KycStatus): Date | undefined {
    if (status === KycStatus.APPROVED) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year validity
      return expiryDate;
    }
    return this.expiresAt;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      level: this.level,
      status: this.status,
      documents: this.documents,
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