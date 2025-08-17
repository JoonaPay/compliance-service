import { IsNotEmpty, IsOptional, IsEnum, IsString, IsUUID, IsEmail, IsPhoneNumber, IsDateString, ValidateNested, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KycLevel {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  ENHANCED = 'ENHANCED',
}

export enum DocumentType {
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  NATIONAL_ID = 'NATIONAL_ID',
  UTILITY_BILL = 'UTILITY_BILL',
  BANK_STATEMENT = 'BANK_STATEMENT',
  SELFIE = 'SELFIE',
  VIDEO_SELFIE = 'VIDEO_SELFIE',
  BIRTH_CERTIFICATE = 'BIRTH_CERTIFICATE',
  OTHER = 'OTHER',
}

export class AddressDto {
  @ApiProperty({ description: 'Street address' })
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty({ description: 'City' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiPropertyOptional({ description: 'State or province' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'Postal code' })
  @IsNotEmpty()
  @IsString()
  postalCode: string;

  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-2)' })
  @IsNotEmpty()
  @IsString()
  country: string;
}

export class PersonalInfoDto {
  @ApiProperty({ description: 'First name' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Date of birth' })
  @IsNotEmpty()
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ description: 'Nationality (ISO 3166-1 alpha-2)' })
  @IsNotEmpty()
  @IsString()
  nationality: string;

  @ApiProperty({ description: 'Residential address', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class InitiateKycRequestDto {
  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'KYC level', enum: KycLevel })
  @IsNotEmpty()
  @IsEnum(KycLevel)
  level: KycLevel;

  @ApiPropertyOptional({ description: 'Verification provider' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'Personal information', type: PersonalInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo?: PersonalInfoDto;

  @ApiPropertyOptional({ description: 'Callback URL for status updates' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UploadDocumentRequestDto {
  @ApiProperty({ description: 'KYC verification ID' })
  @IsNotEmpty()
  @IsUUID()
  verificationId: string;

  @ApiProperty({ description: 'Document type', enum: DocumentType })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({ description: 'Document side (for two-sided documents)' })
  @IsOptional()
  @IsString()
  documentSide?: 'front' | 'back';

  @ApiPropertyOptional({ description: 'Extract data from document' })
  @IsOptional()
  @IsBoolean()
  extractData?: boolean;
}

export class SubmitKycRequestDto {
  @ApiProperty({ description: 'KYC verification ID' })
  @IsNotEmpty()
  @IsUUID()
  verificationId: string;

  @ApiProperty({ description: 'Final declaration confirmation' })
  @IsNotEmpty()
  @IsBoolean()
  finalDeclaration: boolean;
}

export class ReviewKycRequestDto {
  @ApiProperty({ description: 'KYC verification ID' })
  @IsNotEmpty()
  @IsUUID()
  verificationId: string;

  @ApiProperty({ description: 'Approve or reject' })
  @IsNotEmpty()
  @IsBoolean()
  approve: boolean;

  @ApiProperty({ description: 'Reviewer user ID' })
  @IsNotEmpty()
  @IsUUID()
  reviewedBy: string;

  @ApiPropertyOptional({ description: 'Review notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Override risk assessment' })
  @IsOptional()
  @IsBoolean()
  riskOverride?: boolean;
}

export class BulkProcessRequestDto {
  @ApiProperty({ description: 'KYC verification IDs' })
  @IsNotEmpty()
  @IsArray()
  @IsUUID('4', { each: true })
  verificationIds: string[];

  @ApiProperty({ description: 'Bulk action', enum: ['approve', 'reject', 'review'] })
  @IsNotEmpty()
  @IsString()
  action: 'approve' | 'reject' | 'review';

  @ApiProperty({ description: 'Reviewer user ID' })
  @IsNotEmpty()
  @IsUUID()
  reviewedBy: string;

  @ApiPropertyOptional({ description: 'Reason for bulk action' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class KycQueryDto {
  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by level' })
  @IsOptional()
  @IsEnum(KycLevel)
  level?: KycLevel;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by provider' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'Date from (ISO string)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Date to (ISO string)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}