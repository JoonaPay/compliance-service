import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MetricsService } from '@shared/metrics/metrics.service';
import { DocumentType, BusinessDocumentType, BusinessDetails } from '../entities/kyc-verification.entity';
import { firstValueFrom } from 'rxjs';

export interface DocumentUploadRequest {
  file: Buffer;
  filename: string;
  contentType: string;
  documentType: DocumentType;
  verificationId: string;
}

export interface BusinessDocumentUploadRequest {
  file: Buffer;
  filename: string;
  contentType: string;
  documentType: BusinessDocumentType;
  verificationId: string;
  businessDetails: BusinessDetails;
}

export interface DocumentVerificationResult {
  url: string;
  extractedData: Record<string, any>;
  verificationResults: DocumentVerificationDetails;
}

export interface DocumentVerificationDetails {
  imageQuality: number;
  documentAuthenticity: number;
  faceMatch?: number;
  dataExtraction: number;
  tampering: boolean;
  expired: boolean;
  validationErrors: string[];
}

@Injectable()
export class DocumentVerificationService {
  private readonly logger = new Logger(DocumentVerificationService.name);
  private readonly kycProvider: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {
    this.kycProvider = this.configService.get<string>('kyc.provider', 'jumio');
  }

  async uploadAndVerify(request: DocumentUploadRequest): Promise<DocumentVerificationResult> {
    try {
      this.logger.log(`Uploading and verifying document: ${request.documentType} for ${request.verificationId}`);

      // Validate file
      this.validateDocument(request);

      // Upload to storage
      const uploadUrl = await this.uploadToStorage(request);

      // Verify document based on provider
      let verificationResult: DocumentVerificationDetails;
      
      switch (this.kycProvider) {
        case 'jumio':
          verificationResult = await this.verifyWithJumio(request, uploadUrl);
          break;
        case 'onfido':
          verificationResult = await this.verifyWithOnfido(request, uploadUrl);
          break;
        default:
          verificationResult = await this.mockDocumentVerification(request);
      }

      // Extract data based on document type
      const extractedData = await this.extractDocumentData(request, uploadUrl);

      this.metricsService.recordComplianceOperation('document_verification', 'success');
      this.metricsService.recordDocumentQuality(request.documentType, verificationResult.imageQuality);

      this.logger.log(`Document verification completed: ${request.documentType}, quality: ${verificationResult.imageQuality}`);

      return {
        url: uploadUrl,
        extractedData,
        verificationResults: verificationResult,
      };

    } catch (error) {
      this.logger.error(`Failed to verify document: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('document_verification', 'failure');
      this.metricsService.recordError('document_verification', 'high');
      throw error;
    }
  }

  async uploadAndVerifyBusinessDocument(request: BusinessDocumentUploadRequest): Promise<DocumentVerificationResult> {
    try {
      this.logger.log(`Uploading and verifying business document: ${request.documentType} for ${request.verificationId}`);

      // Validate business document
      this.validateBusinessDocument(request);

      // Upload to storage
      const uploadUrl = await this.uploadBusinessDocumentToStorage(request);

      // Verify business document
      const verificationResult = await this.verifyBusinessDocument(request, uploadUrl);

      // Extract business data
      const extractedData = await this.extractBusinessDocumentData(request, uploadUrl);

      this.metricsService.recordComplianceOperation('business_document_verification', 'success');
      this.metricsService.recordDocumentQuality(request.documentType, verificationResult.imageQuality);

      this.logger.log(`Business document verification completed: ${request.documentType}, quality: ${verificationResult.imageQuality}`);

      return {
        url: uploadUrl,
        extractedData,
        verificationResults: verificationResult,
      };

    } catch (error) {
      this.logger.error(`Failed to verify business document: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('business_document_verification', 'failure');
      this.metricsService.recordError('business_document_verification', 'high');
      throw error;
    }
  }

  private validateDocument(request: DocumentUploadRequest): void {
    // Validate file size (max 10MB)
    if (request.file.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(request.contentType)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, and PDF are allowed');
    }

    // Validate document type for filename
    const fileExtension = request.filename.split('.').pop()?.toLowerCase();
    if (!fileExtension || !['jpg', 'jpeg', 'png', 'pdf'].includes(fileExtension)) {
      throw new BadRequestException('Invalid file extension');
    }
  }

  private validateBusinessDocument(request: BusinessDocumentUploadRequest): void {
    // Similar validation for business documents
    this.validateDocument({
      file: request.file,
      filename: request.filename,
      contentType: request.contentType,
      documentType: request.documentType as any,
      verificationId: request.verificationId,
    });
  }

  private async uploadToStorage(request: DocumentUploadRequest): Promise<string> {
    // Mock implementation - in production, use cloud storage (S3, GCS, etc.)
    const timestamp = Date.now();
    const sanitizedFilename = request.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `kyc-documents/${request.verificationId}/${timestamp}_${sanitizedFilename}`;
    
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return `https://compliance-storage.joonapay.com/${storageKey}`;
  }

  private async uploadBusinessDocumentToStorage(request: BusinessDocumentUploadRequest): Promise<string> {
    // Mock implementation - in production, use cloud storage
    const timestamp = Date.now();
    const sanitizedFilename = request.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `kyb-documents/${request.verificationId}/${timestamp}_${sanitizedFilename}`;
    
    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return `https://compliance-storage.joonapay.com/${storageKey}`;
  }

  private async verifyWithJumio(request: DocumentUploadRequest, url: string): Promise<DocumentVerificationDetails> {
    const apiUrl = this.configService.get<string>('kyc.jumio.apiUrl');
    const apiKey = this.configService.get<string>('kyc.jumio.apiKey');
    const apiSecret = this.configService.get<string>('kyc.jumio.apiSecret');

    if (!apiUrl || !apiKey || !apiSecret) {
      this.logger.warn('Jumio API credentials not configured, using mock verification');
      return this.mockDocumentVerification(request);
    }

    const payload = {
      type: this.mapDocumentTypeToJumio(request.documentType),
      country: 'AUTO',
      userReference: request.verificationId,
      callbackUrl: this.configService.get<string>('kyc.jumio.webhook'),
    };

    const response = await firstValueFrom(
      this.httpService.post(`${apiUrl}/netverify/v2/performNetverify`, payload, {
        auth: {
          username: apiKey,
          password: apiSecret,
        },
        timeout: 30000,
      }),
    );

    return this.parseJumioResponse(response.data);
  }

  private async verifyWithOnfido(request: DocumentUploadRequest, url: string): Promise<DocumentVerificationDetails> {
    const apiUrl = this.configService.get<string>('kyc.onfido.apiUrl');
    const apiKey = this.configService.get<string>('kyc.onfido.apiKey');

    if (!apiUrl || !apiKey) {
      this.logger.warn('Onfido API credentials not configured, using mock verification');
      return this.mockDocumentVerification(request);
    }

    // Create applicant first
    const applicantResponse = await firstValueFrom(
      this.httpService.post(`${apiUrl}/v3/applicants`, {
        first_name: 'Unknown',
        last_name: 'User',
      }, {
        headers: {
          'Authorization': `Token token=${apiKey}`,
          'Content-Type': 'application/json',
        },
      }),
    );

    const applicantId = applicantResponse.data.id;

    // Upload document
    const formData = new FormData();
    const fileBuffer = Buffer.isBuffer(request.file) ? request.file : Buffer.from(request.file as any);
    formData.append('file', new Blob([fileBuffer]), request.filename);
    formData.append('type', this.mapDocumentTypeToOnfido(request.documentType));

    const documentResponse = await firstValueFrom(
      this.httpService.post(`${apiUrl}/v3/documents`, formData, {
        headers: {
          'Authorization': `Token token=${apiKey}`,
        },
      }),
    );

    return this.parseOnfidoResponse(documentResponse.data);
  }

  private async verifyBusinessDocument(request: BusinessDocumentUploadRequest, url: string): Promise<DocumentVerificationDetails> {
    // Business document verification logic
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing

    return {
      imageQuality: 0.9 + Math.random() * 0.1,
      documentAuthenticity: 0.85 + Math.random() * 0.1,
      dataExtraction: 0.8 + Math.random() * 0.15,
      tampering: Math.random() > 0.95,
      expired: Math.random() > 0.98,
      validationErrors: [],
    };
  }

  private async extractDocumentData(request: DocumentUploadRequest, url: string): Promise<Record<string, any>> {
    // Mock data extraction based on document type
    switch (request.documentType) {
      case DocumentType.PASSPORT:
        return {
          documentNumber: `P${Math.random().toString().substr(2, 8)}`,
          fullName: 'John Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'US',
          issuingCountry: 'US',
          expiryDate: '2030-01-01',
        };

      case DocumentType.DRIVER_LICENSE:
        return {
          licenseNumber: `DL${Math.random().toString().substr(2, 8)}`,
          fullName: 'John Doe',
          dateOfBirth: '1990-01-01',
          address: '123 Main St, City, State',
          expiryDate: '2025-01-01',
        };

      case DocumentType.NATIONAL_ID:
        return {
          idNumber: `ID${Math.random().toString().substr(2, 8)}`,
          fullName: 'John Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'US',
        };

      case DocumentType.UTILITY_BILL:
        return {
          fullName: 'John Doe',
          address: '123 Main St, City, State',
          billDate: new Date().toISOString().split('T')[0],
          provider: 'Electric Company',
        };

      default:
        return {};
    }
  }

  private async extractBusinessDocumentData(request: BusinessDocumentUploadRequest, url: string): Promise<Record<string, any>> {
    // Mock business data extraction
    switch (request.documentType) {
      case BusinessDocumentType.CERTIFICATE_OF_INCORPORATION:
        return {
          companyName: request.businessDetails.name,
          registrationNumber: `REG${Math.random().toString().substr(2, 8)}`,
          incorporationDate: '2020-01-01',
          incorporationState: 'Delaware',
          businessType: request.businessDetails.businessType,
        };

      case BusinessDocumentType.BUSINESS_LICENSE:
        return {
          licenseNumber: `LIC${Math.random().toString().substr(2, 8)}`,
          businessName: request.businessDetails.name,
          licenseType: 'General Business License',
          issuedDate: '2020-01-01',
          expiryDate: '2025-01-01',
        };

      case BusinessDocumentType.TAX_REGISTRATION:
        return {
          taxId: `TAX${Math.random().toString().substr(2, 8)}`,
          businessName: request.businessDetails.name,
          registrationDate: '2020-01-01',
        };

      default:
        return {
          businessName: request.businessDetails.name,
          documentDate: new Date().toISOString().split('T')[0],
        };
    }
  }

  private async mockDocumentVerification(request: DocumentUploadRequest): Promise<DocumentVerificationDetails> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    const isHighQuality = Math.random() > 0.1;
    
    return {
      imageQuality: isHighQuality ? 0.9 + Math.random() * 0.1 : 0.5 + Math.random() * 0.3,
      documentAuthenticity: isHighQuality ? 0.95 + Math.random() * 0.05 : 0.7 + Math.random() * 0.2,
      faceMatch: request.documentType === DocumentType.SELFIE ? 0.9 + Math.random() * 0.1 : undefined,
      dataExtraction: isHighQuality ? 0.9 + Math.random() * 0.1 : 0.6 + Math.random() * 0.3,
      tampering: Math.random() > 0.95,
      expired: Math.random() > 0.98,
      validationErrors: [],
    };
  }

  private mapDocumentTypeToJumio(type: DocumentType): string {
    switch (type) {
      case DocumentType.PASSPORT: return 'PASSPORT';
      case DocumentType.DRIVER_LICENSE: return 'DRIVING_LICENSE';
      case DocumentType.NATIONAL_ID: return 'IDENTITY_CARD';
      default: return 'IDENTITY_CARD';
    }
  }

  private mapDocumentTypeToOnfido(type: DocumentType): string {
    switch (type) {
      case DocumentType.PASSPORT: return 'passport';
      case DocumentType.DRIVER_LICENSE: return 'driving_licence';
      case DocumentType.NATIONAL_ID: return 'national_identity_card';
      default: return 'national_identity_card';
    }
  }

  private parseJumioResponse(data: any): DocumentVerificationDetails {
    return {
      imageQuality: data.imageQuality || 0.8,
      documentAuthenticity: data.documentAuthenticity || 0.9,
      faceMatch: data.faceMatch,
      dataExtraction: data.extractionConfidence || 0.85,
      tampering: data.tampering || false,
      expired: data.expired || false,
      validationErrors: data.errors || [],
    };
  }

  private parseOnfidoResponse(data: any): DocumentVerificationDetails {
    return {
      imageQuality: data.image_integrity?.score || 0.8,
      documentAuthenticity: data.visual_authenticity?.score || 0.9,
      faceMatch: data.face_comparison?.score,
      dataExtraction: data.data_extraction?.score || 0.85,
      tampering: data.image_integrity?.breakdown?.digital_tampering === 'detected',
      expired: data.data_validation?.breakdown?.expiry_date === 'expired',
      validationErrors: data.data_validation?.breakdown ? Object.keys(data.data_validation.breakdown).filter(
        key => data.data_validation.breakdown[key] === 'error'
      ) : [],
    };
  }
}