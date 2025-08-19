import { IsNotEmpty, IsOptional, IsEnum, IsString, IsUUID, IsEmail, IsPhoneNumber, IsDateString, ValidateNested, IsBoolean, IsArray, IsNumber, Min, Max, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BusinessType {
  CORPORATION = 'CORPORATION',
  LLC = 'LLC',
  PARTNERSHIP = 'PARTNERSHIP',
  SOLE_PROPRIETORSHIP = 'SOLE_PROPRIETORSHIP',
  NON_PROFIT = 'NON_PROFIT',
  TRUST = 'TRUST',
  FOUNDATION = 'FOUNDATION',
  OTHER = 'OTHER',
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

export enum ControlMechanism {
  DIRECT_OWNERSHIP = 'DIRECT_OWNERSHIP',
  INDIRECT_OWNERSHIP = 'INDIRECT_OWNERSHIP',
  VOTING_RIGHTS = 'VOTING_RIGHTS',
  BOARD_CONTROL = 'BOARD_CONTROL',
  OTHER = 'OTHER',
}

export class BusinessAddressDto {
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

export class BeneficialOwnerDto {
  @ApiProperty({ description: 'Owner type', enum: ['INDIVIDUAL', 'ENTITY'] })
  @IsNotEmpty()
  @IsEnum(['INDIVIDUAL', 'ENTITY'])
  ownerType: 'INDIVIDUAL' | 'ENTITY';

  @ApiProperty({ description: 'Ownership percentage', minimum: 0, maximum: 100 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage: number;

  @ApiPropertyOptional({ description: 'Control percentage', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  controlPercentage?: number;

  @ApiProperty({ description: 'Control mechanism', enum: ControlMechanism })
  @IsNotEmpty()
  @IsEnum(ControlMechanism)
  controlMechanism: ControlMechanism;

  @ApiPropertyOptional({ description: 'Control description' })
  @IsOptional()
  @IsString()
  controlDescription?: string;

  // Individual fields
  @ApiPropertyOptional({ description: 'First name (for individuals)' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Middle name (for individuals)' })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiPropertyOptional({ description: 'Last name (for individuals)' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Date of birth (for individuals)' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Nationality (for individuals)' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ description: 'ID document type (for individuals)' })
  @IsOptional()
  @IsString()
  idDocumentType?: string;

  @ApiPropertyOptional({ description: 'ID document number (for individuals)' })
  @IsOptional()
  @IsString()
  idDocumentNumber?: string;

  @ApiPropertyOptional({ description: 'ID document country (for individuals)' })
  @IsOptional()
  @IsString()
  idDocumentCountry?: string;

  @ApiPropertyOptional({ description: 'Residential address (for individuals)', type: BusinessAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessAddressDto)
  residentialAddress?: BusinessAddressDto;

  @ApiPropertyOptional({ description: 'Occupation (for individuals)' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ description: 'Employer (for individuals)' })
  @IsOptional()
  @IsString()
  employer?: string;

  // Entity fields
  @ApiPropertyOptional({ description: 'Entity name (for entities)' })
  @IsOptional()
  @IsString()
  entityName?: string;

  @ApiPropertyOptional({ description: 'Entity type (for entities)', enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  entityType?: BusinessType;

  @ApiPropertyOptional({ description: 'Entity registration number (for entities)' })
  @IsOptional()
  @IsString()
  entityRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'Entity jurisdiction (for entities)' })
  @IsOptional()
  @IsString()
  entityJurisdiction?: string;

  @ApiPropertyOptional({ description: 'Entity address (for entities)', type: BusinessAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessAddressDto)
  entityAddress?: BusinessAddressDto;

  @ApiPropertyOptional({ description: 'Entity industry (for entities)' })
  @IsOptional()
  @IsString()
  entityIndustry?: string;

  @ApiPropertyOptional({ description: 'Effective from date' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Effective until date' })
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;

  @ApiPropertyOptional({ description: 'Source of information', enum: ['SELF_DECLARED', 'CORPORATE_REGISTRY', 'FINANCIAL_STATEMENTS', 'OTHER_OFFICIAL', 'THIRD_PARTY'] })
  @IsOptional()
  @IsEnum(['SELF_DECLARED', 'CORPORATE_REGISTRY', 'FINANCIAL_STATEMENTS', 'OTHER_OFFICIAL', 'THIRD_PARTY'])
  sourceOfInformation?: 'SELF_DECLARED' | 'CORPORATE_REGISTRY' | 'FINANCIAL_STATEMENTS' | 'OTHER_OFFICIAL' | 'THIRD_PARTY';
}

export class InitiateKybRequestDto {
  @ApiProperty({ description: 'Business account ID' })
  @IsNotEmpty()
  @IsUUID()
  businessId: string;

  @ApiProperty({ description: 'Business name' })
  @IsNotEmpty()
  @IsString()
  businessName: string;

  @ApiProperty({ description: 'Business type', enum: BusinessType })
  @IsNotEmpty()
  @IsEnum(BusinessType)
  businessType: BusinessType;

  @ApiPropertyOptional({ description: 'Registration number' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'Tax ID' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Incorporation date' })
  @IsOptional()
  @IsDateString()
  incorporationDate?: string;

  @ApiProperty({ description: 'Incorporation country (ISO 3166-1 alpha-2)' })
  @IsNotEmpty()
  @IsString()
  incorporationCountry: string;

  @ApiPropertyOptional({ description: 'Incorporation state' })
  @IsOptional()
  @IsString()
  incorporationState?: string;

  @ApiProperty({ description: 'Business address', type: BusinessAddressDto })
  @ValidateNested()
  @Type(() => BusinessAddressDto)
  businessAddress: BusinessAddressDto;

  @ApiPropertyOptional({ description: 'Operational address (if different)', type: BusinessAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessAddressDto)
  operationalAddress?: BusinessAddressDto;

  @ApiPropertyOptional({ description: 'Industry code (NAICS or SIC)' })
  @IsOptional()
  @IsString()
  industryCode?: string;

  @ApiPropertyOptional({ description: 'Business description' })
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ description: 'Annual revenue' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @ApiPropertyOptional({ description: 'Employee count' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  employeeCount?: number;

  @ApiPropertyOptional({ description: 'Verification provider' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'Callback URL for status updates' })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UploadBusinessDocumentRequestDto {
  @ApiProperty({ description: 'KYB verification ID' })
  @IsNotEmpty()
  @IsUUID()
  verificationId: string;

  @ApiProperty({ description: 'Business document type', enum: BusinessDocumentType })
  @IsNotEmpty()
  @IsEnum(BusinessDocumentType)
  documentType: BusinessDocumentType;

  @ApiPropertyOptional({ description: 'Document side (for two-sided documents)' })
  @IsOptional()
  @IsString()
  documentSide?: 'front' | 'back';

  @ApiPropertyOptional({ description: 'Extract data from document' })
  @IsOptional()
  @IsBoolean()
  extractData?: boolean;

  @ApiPropertyOptional({ description: 'Document description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AddBeneficialOwnerRequestDto {
  @ApiProperty({ description: 'KYB verification ID' })
  @IsNotEmpty()
  @IsUUID()
  verificationId: string;

  @ApiProperty({ description: 'Beneficial owner details', type: BeneficialOwnerDto })
  @ValidateNested()
  @Type(() => BeneficialOwnerDto)
  beneficialOwner: BeneficialOwnerDto;
}

export class SubmitKybRequestDto {
  @ApiProperty({ description: 'KYB verification ID' })
  @IsNotEmpty()
  @IsUUID()
  verificationId: string;

  @ApiProperty({ description: 'UBO declaration confirmation' })
  @IsNotEmpty()
  @IsBoolean()
  uboDeclaration: boolean;

  @ApiProperty({ description: 'Final declaration confirmation' })
  @IsNotEmpty()
  @IsBoolean()
  finalDeclaration: boolean;

  @ApiPropertyOptional({ description: 'Authorized signatory name' })
  @IsOptional()
  @IsString()
  authorizedSignatory?: string;

  @ApiPropertyOptional({ description: 'Signatory position' })
  @IsOptional()
  @IsString()
  signatoryPosition?: string;
}

export class ReviewKybRequestDto {
  @ApiProperty({ description: 'KYB verification ID' })
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

export class KybQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by business type', enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({ description: 'Filter by business ID' })
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @ApiPropertyOptional({ description: 'Filter by business name' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ description: 'Filter by country' })
  @IsOptional()
  @IsString()
  country?: string;

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