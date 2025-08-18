import { BaseDomainEntity } from '@core/domain/base-domain-entity';

export enum KycVerificationType {
  IDENTITY_VERIFICATION = 'IDENTITY_VERIFICATION',
  DOCUMENT_VERIFICATION = 'DOCUMENT_VERIFICATION', 
  ADDRESS_VERIFICATION = 'ADDRESS_VERIFICATION',
  ENHANCED_DUE_DILIGENCE = 'ENHANCED_DUE_DILIGENCE'
}

export enum DocumentType {
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  NATIONAL_ID = 'NATIONAL_ID',
  UTILITY_BILL = 'UTILITY_BILL',
  BANK_STATEMENT = 'BANK_STATEMENT',
  OTHER = 'OTHER'
}

export enum KycStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REQUIRES_MANUAL_REVIEW = 'REQUIRES_MANUAL_REVIEW'
}

export enum KycProvider {
  JUMIO = 'JUMIO',
  ONFIDO = 'ONFIDO',
  MANUAL = 'MANUAL'
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}

export interface KycVerificationEntityProps {
  id?: string;
  userId: string;
  verificationReference?: string;
  verificationType: KycVerificationType;
  documentType?: DocumentType;
  status?: KycStatus;
  provider?: KycProvider;
  providerVerificationId?: string;
  personalInfo: PersonalInfo;
  documentData?: Record<string, any>;
  verificationResults?: Record<string, any>;
  riskScore?: number;
  riskFactors?: Record<string, any>;
  rejectionReasons?: string[];
  manualReviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  expiresAt?: Date;
  submittedAt?: Date;
  completedAt?: Date;
  attemptCount?: number;
  maxAttempts?: number;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export class KycVerificationEntity extends BaseDomainEntity {
  private _userId: string;
  private _verificationReference: string;
  private _verificationType: KycVerificationType;
  private _documentType?: DocumentType;
  private _status: KycStatus;
  private _provider: KycProvider;
  private _providerVerificationId?: string;
  private _personalInfo: PersonalInfo;
  private _documentData?: Record<string, any>;
  private _verificationResults?: Record<string, any>;
  private _riskScore?: number;
  private _riskFactors?: Record<string, any>;
  private _rejectionReasons?: string[];
  private _manualReviewNotes?: string;
  private _reviewedBy?: string;
  private _reviewedAt?: Date;
  private _expiresAt?: Date;
  private _submittedAt?: Date;
  private _completedAt?: Date;
  private _attemptCount: number;
  private _maxAttempts: number;
  private _metadata?: Record<string, any>;
  public readonly isActive: boolean;

  constructor(props: KycVerificationEntityProps) {
    super(props.id);
    this._userId = props.userId;
    this._verificationReference = props.verificationReference || this.generateReference();
    this._verificationType = props.verificationType;
    this._documentType = props.documentType;
    this._status = props.status || KycStatus.PENDING;
    this._provider = props.provider || KycProvider.MANUAL;
    this._providerVerificationId = props.providerVerificationId;
    this._personalInfo = props.personalInfo;
    this._documentData = props.documentData;
    this._verificationResults = props.verificationResults;
    this._riskScore = props.riskScore;
    this._riskFactors = props.riskFactors;
    this._rejectionReasons = props.rejectionReasons;
    this._manualReviewNotes = props.manualReviewNotes;
    this._reviewedBy = props.reviewedBy;
    this._reviewedAt = props.reviewedAt;
    this._expiresAt = props.expiresAt;
    this._submittedAt = props.submittedAt;
    this._completedAt = props.completedAt;
    this._attemptCount = props.attemptCount || 1;
    this._maxAttempts = props.maxAttempts || 3;
    this._metadata = props.metadata;
    this.isActive = props.isActive !== false;
  }

  // Business methods
  submit(): void {
    if (this._status !== KycStatus.PENDING) {
      throw new Error('Can only submit pending verifications');
    }
    this._status = KycStatus.IN_PROGRESS;
    this._submittedAt = new Date();
  }

  approve(reviewedBy: string): void {
    if (this._status !== KycStatus.IN_PROGRESS && this._status !== KycStatus.REQUIRES_MANUAL_REVIEW) {
      throw new Error('Can only approve in-progress or manual review verifications');
    }
    this._status = KycStatus.APPROVED;
    this._reviewedBy = reviewedBy;
    this._reviewedAt = new Date();
    this._completedAt = new Date();
  }

  reject(reasons: string[], reviewedBy: string): void {
    if (this._status !== KycStatus.IN_PROGRESS && this._status !== KycStatus.REQUIRES_MANUAL_REVIEW) {
      throw new Error('Can only reject in-progress or manual review verifications');
    }
    this._status = KycStatus.REJECTED;
    this._rejectionReasons = reasons;
    this._reviewedBy = reviewedBy;
    this._reviewedAt = new Date();
    this._completedAt = new Date();
  }

  requireManualReview(notes: string): void {
    if (this._status !== KycStatus.IN_PROGRESS) {
      throw new Error('Can only flag in-progress verifications for manual review');
    }
    this._status = KycStatus.REQUIRES_MANUAL_REVIEW;
    this._manualReviewNotes = notes;
  }

  updateRiskScore(score: number, factors: Record<string, any>): void {
    this._riskScore = score;
    this._riskFactors = factors;
  }

  private generateReference(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `KYC${date}${random}`;
  }

  // Getters
  get userId(): string { return this._userId; }
  get verificationReference(): string { return this._verificationReference; }
  get verificationType(): KycVerificationType { return this._verificationType; }
  get documentType(): DocumentType | undefined { return this._documentType; }
  get status(): KycStatus { return this._status; }
  get provider(): KycProvider { return this._provider; }
  get providerVerificationId(): string | undefined { return this._providerVerificationId; }
  get personalInfo(): PersonalInfo { return this._personalInfo; }
  get documentData(): Record<string, any> | undefined { return this._documentData; }
  get verificationResults(): Record<string, any> | undefined { return this._verificationResults; }
  get riskScore(): number | undefined { return this._riskScore; }
  get riskFactors(): Record<string, any> | undefined { return this._riskFactors; }
  get rejectionReasons(): string[] | undefined { return this._rejectionReasons; }
  get manualReviewNotes(): string | undefined { return this._manualReviewNotes; }
  get reviewedBy(): string | undefined { return this._reviewedBy; }
  get reviewedAt(): Date | undefined { return this._reviewedAt; }
  get expiresAt(): Date | undefined { return this._expiresAt; }
  get submittedAt(): Date | undefined { return this._submittedAt; }
  get completedAt(): Date | undefined { return this._completedAt; }
  get attemptCount(): number { return this._attemptCount; }
  get maxAttempts(): number { return this._maxAttempts; }
  get metadata(): Record<string, any> | undefined { return this._metadata; }
}