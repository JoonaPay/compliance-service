import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KybStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REQUIRES_MANUAL_REVIEW = 'REQUIRES_MANUAL_REVIEW',
}

export enum KybVerificationStage {
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
  DOCUMENTS_UPLOADED = 'DOCUMENTS_UPLOADED',
  BUSINESS_VERIFICATION = 'BUSINESS_VERIFICATION',
  UBO_VERIFICATION = 'UBO_VERIFICATION',
  COMPLETED = 'COMPLETED',
}

export class BusinessDocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  id: string;

  @ApiProperty({ description: 'Document type' })
  type: string;

  @ApiProperty({ description: 'Original filename' })
  filename: string;

  @ApiProperty({ description: 'Document URL' })
  url: string;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;

  @ApiPropertyOptional({ description: 'Document side' })
  documentSide?: string;

  @ApiPropertyOptional({ description: 'Document description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Extracted data from document' })
  extractedData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Verification results' })
  verificationResults?: Record<string, any>;
}

export class BeneficialOwnerResponseDto {
  @ApiProperty({ description: 'UBO ID' })
  id: string;

  @ApiProperty({ description: 'UBO reference' })
  uboReference: string;

  @ApiProperty({ description: 'Owner type' })
  ownerType: 'INDIVIDUAL' | 'ENTITY';

  @ApiProperty({ description: 'Ownership percentage' })
  ownershipPercentage: number;

  @ApiPropertyOptional({ description: 'Control percentage' })
  controlPercentage?: number;

  @ApiProperty({ description: 'Is ultimate beneficial owner' })
  isUltimateBeneficialOwner: boolean;

  @ApiProperty({ description: 'Control mechanism' })
  controlMechanism: string;

  @ApiPropertyOptional({ description: 'Control description' })
  controlDescription?: string;

  // Individual fields
  @ApiPropertyOptional({ description: 'First name' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Middle name' })
  middleName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  dateOfBirth?: Date;

  @ApiPropertyOptional({ description: 'Nationality' })
  nationality?: string;

  @ApiPropertyOptional({ description: 'ID document type' })
  idDocumentType?: string;

  @ApiPropertyOptional({ description: 'ID document number' })
  idDocumentNumber?: string;

  @ApiPropertyOptional({ description: 'ID document country' })
  idDocumentCountry?: string;

  @ApiPropertyOptional({ description: 'Residential address' })
  residentialAddress?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Occupation' })
  occupation?: string;

  @ApiPropertyOptional({ description: 'Employer' })
  employer?: string;

  // Entity fields
  @ApiPropertyOptional({ description: 'Entity name' })
  entityName?: string;

  @ApiPropertyOptional({ description: 'Entity type' })
  entityType?: string;

  @ApiPropertyOptional({ description: 'Entity registration number' })
  entityRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'Entity jurisdiction' })
  entityJurisdiction?: string;

  @ApiPropertyOptional({ description: 'Entity address' })
  entityAddress?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Entity industry' })
  entityIndustry?: string;

  @ApiProperty({ description: 'Verification status' })
  verificationStatus: string;

  @ApiPropertyOptional({ description: 'KYC verification ID' })
  kycVerificationId?: string;

  @ApiProperty({ description: 'Sanctions screened' })
  sanctionsScreened: boolean;

  @ApiPropertyOptional({ description: 'Sanctions screening ID' })
  sanctionsScreeningId?: string;

  @ApiProperty({ description: 'PEP status' })
  pepStatus: string;

  @ApiPropertyOptional({ description: 'Risk level' })
  riskLevel?: string;

  @ApiPropertyOptional({ description: 'Risk score' })
  riskScore?: number;

  @ApiPropertyOptional({ description: 'Risk factors' })
  riskFactors?: string[];

  @ApiProperty({ description: 'Is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Effective from date' })
  effectiveFrom?: Date;

  @ApiPropertyOptional({ description: 'Effective until date' })
  effectiveUntil?: Date;

  @ApiProperty({ description: 'Source of information' })
  sourceOfInformation: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class KybRiskAssessmentResponseDto {
  @ApiProperty({ description: 'Risk score (0-1)' })
  score: number;

  @ApiProperty({ description: 'Risk factors' })
  factors: string[];

  @ApiProperty({ description: 'Business sanctions match found' })
  sanctionsMatch: boolean;

  @ApiProperty({ description: 'PEP match found' })
  pepMatch: boolean;

  @ApiProperty({ description: 'Adverse media match found' })
  adverseMediaMatch: boolean;

  @ApiProperty({ description: 'Country risk score' })
  countryRisk: number;

  @ApiProperty({ description: 'Industry risk score' })
  industryRisk: number;

  @ApiProperty({ description: 'UBO risk score' })
  uboRisk: number;

  @ApiProperty({ description: 'Corporate structure risk score' })
  structureRisk: number;

  @ApiProperty({ description: 'Assessment timestamp' })
  assessedAt: Date;
}

export class KybVerificationResponseDto {
  @ApiProperty({ description: 'Verification ID' })
  id: string;

  @ApiProperty({ description: 'Business ID' })
  businessId: string;

  @ApiProperty({ description: 'Verification reference' })
  verificationReference: string;

  @ApiProperty({ description: 'Business name' })
  businessName: string;

  @ApiProperty({ description: 'Business type' })
  businessType: string;

  @ApiPropertyOptional({ description: 'Registration number' })
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  taxId?: string;

  @ApiPropertyOptional({ description: 'Incorporation date' })
  incorporationDate?: Date;

  @ApiProperty({ description: 'Incorporation country' })
  incorporationCountry: string;

  @ApiPropertyOptional({ description: 'Incorporation state' })
  incorporationState?: string;

  @ApiProperty({ description: 'Business address' })
  businessAddress: Record<string, any>;

  @ApiPropertyOptional({ description: 'Operational address' })
  operationalAddress?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Industry code' })
  industryCode?: string;

  @ApiPropertyOptional({ description: 'Business description' })
  businessDescription?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  websiteUrl?: string;

  @ApiPropertyOptional({ description: 'Annual revenue' })
  annualRevenue?: number;

  @ApiPropertyOptional({ description: 'Employee count' })
  employeeCount?: number;

  @ApiProperty({ description: 'Current status', enum: KybStatus })
  status: KybStatus;

  @ApiProperty({ description: 'Verification stage', enum: KybVerificationStage })
  verificationStage: KybVerificationStage;

  @ApiPropertyOptional({ description: 'Risk level' })
  riskLevel?: string;

  @ApiPropertyOptional({ description: 'Risk score' })
  riskScore?: number;

  @ApiPropertyOptional({ description: 'Risk factors' })
  riskFactors?: string[];

  @ApiProperty({ description: 'Document requirements' })
  documentRequirements: Record<string, any>;

  @ApiProperty({ description: 'Submitted documents', type: [BusinessDocumentResponseDto] })
  submittedDocuments: BusinessDocumentResponseDto[];

  @ApiPropertyOptional({ description: 'Verification results' })
  verificationResults?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Corporate structure' })
  corporateStructure?: Record<string, any>;

  @ApiProperty({ description: 'UBO verified' })
  uboVerified: boolean;

  @ApiProperty({ description: 'Beneficial owners', type: [BeneficialOwnerResponseDto] })
  beneficialOwners: BeneficialOwnerResponseDto[];

  @ApiProperty({ description: 'Sanctions screened' })
  sanctionsScreened: boolean;

  @ApiProperty({ description: 'PEP screened' })
  pepScreened: boolean;

  @ApiPropertyOptional({ description: 'Risk assessment', type: KybRiskAssessmentResponseDto })
  riskAssessment?: KybRiskAssessmentResponseDto;

  @ApiPropertyOptional({ description: 'Verification provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Provider verification ID' })
  providerVerificationId?: string;

  @ApiPropertyOptional({ description: 'Rejection reasons' })
  rejectionReasons?: string[];

  @ApiPropertyOptional({ description: 'Manual review notes' })
  manualReviewNotes?: string;

  @ApiPropertyOptional({ description: 'Reviewer user ID' })
  reviewedBy?: string;

  @ApiPropertyOptional({ description: 'Review timestamp' })
  reviewedAt?: Date;

  @ApiPropertyOptional({ description: 'Expiry timestamp' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Submission timestamp' })
  submittedAt?: Date;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Callback URL' })
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Webhook data' })
  webhookData?: Record<string, any>;

  @ApiProperty({ description: 'Attempt count' })
  attemptCount: number;

  @ApiProperty({ description: 'Max attempts' })
  maxAttempts: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class KybStatisticsResponseDto {
  @ApiProperty({ description: 'Total verifications' })
  total: number;

  @ApiProperty({ description: 'Pending verifications' })
  pending: number;

  @ApiProperty({ description: 'In progress verifications' })
  inProgress: number;

  @ApiProperty({ description: 'Approved verifications' })
  approved: number;

  @ApiProperty({ description: 'Rejected verifications' })
  rejected: number;

  @ApiProperty({ description: 'Expired verifications' })
  expired: number;

  @ApiProperty({ description: 'Verifications requiring manual review' })
  requiresReview: number;

  @ApiProperty({ description: 'Average processing time in minutes' })
  avgProcessingTime: number;

  @ApiProperty({ description: 'Approval rate (0-1)' })
  approvalRate: number;

  @ApiProperty({ description: 'Rejection rate (0-1)' })
  rejectionRate: number;

  @ApiProperty({ description: 'UBO completion rate (0-1)' })
  uboCompletionRate: number;

  @ApiProperty({ description: 'Risk distribution by level' })
  riskDistribution: Record<string, number>;

  @ApiProperty({ description: 'Business type distribution' })
  businessTypeDistribution: Record<string, number>;

  @ApiProperty({ description: 'Country distribution' })
  countryDistribution: Record<string, number>;
}

export class KybListResponseDto {
  @ApiProperty({ description: 'KYB verifications', type: [KybVerificationResponseDto] })
  items: KybVerificationResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}

export class RequiredBusinessDocumentsResponseDto {
  @ApiProperty({ description: 'Business type' })
  businessType: string;

  @ApiProperty({ description: 'Incorporation country' })
  incorporationCountry: string;

  @ApiProperty({ description: 'Required document types' })
  requiredDocuments: string[];

  @ApiProperty({ description: 'Optional document types' })
  optionalDocuments: string[];

  @ApiProperty({ description: 'Document requirements and guidelines' })
  requirements: Record<string, {
    description: string;
    acceptedFormats: string[];
    maxSizeMB: number;
    qualityRequirements: string[];
    isRequired: boolean;
  }>;

  @ApiProperty({ description: 'UBO threshold percentage' })
  uboThreshold: number;

  @ApiProperty({ description: 'Minimum UBO information required' })
  uboRequirements: {
    minimumOwnershipPercentage: number;
    requiresIndividualVerification: boolean;
    maxUboCount: number;
  };
}

export class UboValidationResponseDto {
  @ApiProperty({ description: 'Validation passed' })
  isValid: boolean;

  @ApiProperty({ description: 'Total ownership percentage' })
  totalOwnership: number;

  @ApiProperty({ description: 'Number of UBOs' })
  uboCount: number;

  @ApiProperty({ description: 'Validation errors' })
  errors: string[];

  @ApiProperty({ description: 'Validation warnings' })
  warnings: string[];

  @ApiProperty({ description: 'UBO coverage complete' })
  coverageComplete: boolean;
}

export class CorporateStructureResponseDto {
  @ApiProperty({ description: 'Structure analysis' })
  analysis: {
    totalLayers: number;
    complexityScore: number;
    riskIndicators: string[];
    ownershipClarity: number;
  };

  @ApiProperty({ description: 'Ownership chain' })
  ownershipChain: Array<{
    level: number;
    entity: string;
    ownershipPercentage: number;
    controlMechanism: string;
  }>;

  @ApiProperty({ description: 'Ultimate beneficial owners' })
  ultimateBeneficialOwners: Array<{
    name: string;
    ownershipPercentage: number;
    controlPercentage: number;
    verified: boolean;
  }>;
}