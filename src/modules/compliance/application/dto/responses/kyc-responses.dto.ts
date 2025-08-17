import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KycStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REQUIRES_MANUAL_REVIEW = 'REQUIRES_MANUAL_REVIEW',
}

export class DocumentResponseDto {
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

  @ApiPropertyOptional({ description: 'Extracted data from document' })
  extractedData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Verification results' })
  verificationResults?: Record<string, any>;
}

export class RiskAssessmentResponseDto {
  @ApiProperty({ description: 'Risk score (0-1)' })
  score: number;

  @ApiProperty({ description: 'Risk factors' })
  factors: string[];

  @ApiProperty({ description: 'Sanctions match found' })
  sanctionsMatch: boolean;

  @ApiProperty({ description: 'PEP match found' })
  pepMatch: boolean;

  @ApiProperty({ description: 'Adverse media match found' })
  adverseMediaMatch: boolean;

  @ApiProperty({ description: 'Country risk score' })
  countryRisk: number;

  @ApiProperty({ description: 'Assessment timestamp' })
  assessedAt: Date;
}

export class KycVerificationResponseDto {
  @ApiProperty({ description: 'Verification ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'KYC level' })
  level: string;

  @ApiProperty({ description: 'Current status', enum: KycStatus })
  status: KycStatus;

  @ApiProperty({ description: 'Uploaded documents', type: [DocumentResponseDto] })
  documents: DocumentResponseDto[];

  @ApiPropertyOptional({ description: 'Risk assessment', type: RiskAssessmentResponseDto })
  riskAssessment?: RiskAssessmentResponseDto;

  @ApiPropertyOptional({ description: 'Verification provider' })
  provider?: string;

  @ApiPropertyOptional({ description: 'Provider reference ID' })
  providerReference?: string;

  @ApiPropertyOptional({ description: 'Reviewer user ID' })
  reviewedBy?: string;

  @ApiPropertyOptional({ description: 'Review notes' })
  reviewNotes?: string;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Submission timestamp' })
  submittedAt?: Date;

  @ApiPropertyOptional({ description: 'Approval timestamp' })
  approvedAt?: Date;

  @ApiPropertyOptional({ description: 'Expiry timestamp' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class KycStatisticsResponseDto {
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

  @ApiProperty({ description: 'Risk distribution by level' })
  riskDistribution: Record<string, number>;
}

export class KycListResponseDto {
  @ApiProperty({ description: 'KYC verifications', type: [KycVerificationResponseDto] })
  items: KycVerificationResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}

export class BulkProcessResponseDto {
  @ApiProperty({ description: 'Successfully processed verification IDs' })
  successfulIds: string[];

  @ApiProperty({ description: 'Failed verification IDs with errors' })
  failedIds: { id: string; error: string }[];

  @ApiProperty({ description: 'Total processed' })
  totalProcessed: number;

  @ApiProperty({ description: 'Total successful' })
  totalSuccessful: number;

  @ApiProperty({ description: 'Total failed' })
  totalFailed: number;
}

export class DocumentUploadResponseDto {
  @ApiProperty({ description: 'Document ID' })
  documentId: string;

  @ApiProperty({ description: 'Upload URL for client upload' })
  uploadUrl: string;

  @ApiProperty({ description: 'Upload expiry timestamp' })
  expiresAt: Date;

  @ApiProperty({ description: 'Required headers for upload' })
  requiredHeaders: Record<string, string>;
}

export class KycWorkflowEventResponseDto {
  @ApiProperty({ description: 'Event ID' })
  eventId: string;

  @ApiProperty({ description: 'Verification ID' })
  verificationId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Event type' })
  event: string;

  @ApiProperty({ description: 'Event data' })
  data: Record<string, any>;

  @ApiProperty({ description: 'Event timestamp' })
  timestamp: Date;
}

export class RequiredDocumentsResponseDto {
  @ApiProperty({ description: 'KYC level' })
  level: string;

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
  }>;
}