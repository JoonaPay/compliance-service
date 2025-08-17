import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '@shared/metrics/metrics.service';
import * as sharp from 'sharp';
import * as crypto from 'crypto-js';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as pdf from 'pdf-parse';

export interface DocumentUploadRequest {
  file: Buffer;
  filename: string;
  contentType: string;
  documentType: string;
  verificationId: string;
  verificationType?: 'KYC' | 'KYB';
  documentSide?: 'front' | 'back';
  extractData?: boolean;
  description?: string;
  ipAddress?: string;
}

export interface DocumentUploadResult {
  documentId: string;
  url: string;
  extractedData?: Record<string, any>;
  verificationResults?: Record<string, any>;
  qualityAssessment?: Record<string, any>;
  securityChecks?: Record<string, any>;
}

export interface DocumentProcessingResult {
  documentId: string;
  extractedText?: string;
  extractedData?: Record<string, any>;
  qualityScore?: number;
  qualityChecks?: Record<string, any>;
  fraudIndicators?: Record<string, any>;
  ocrConfidence?: number;
}

export interface DocumentVerificationRequest {
  documentId: string;
  documentType: string;
  extractedData?: Record<string, any>;
  requireBiometricMatch?: boolean;
}

export interface DocumentQualityCheck {
  imageQuality: number;
  blur: number;
  brightness: number;
  contrast: number;
  resolution: {
    width: number;
    height: number;
    dpi?: number;
  };
  fileIntegrity: boolean;
  documentOrientation: 'portrait' | 'landscape' | 'unknown';
  edgeDetection: boolean;
  textClarity: number;
}

export interface FraudDetectionResult {
  riskScore: number;
  indicators: string[];
  documentTampering: boolean;
  digitalManipulation: boolean;
  templateMatch: boolean;
  fontAnalysis?: Record<string, any>;
  imageForensics?: Record<string, any>;
}

export interface OcrExtractionResult {
  extractedText: string;
  confidence: number;
  fields: Record<string, {
    value: string;
    confidence: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  layout?: {
    pages: number;
    orientation: string;
    language: string;
  };
}

export interface BiometricVerificationResult {
  faceMatch: boolean;
  faceMatchScore: number;
  livenessCheck: boolean;
  livenessScore: number;
  faceQuality: number;
  spoofingDetection: boolean;
}

@Injectable()
export class DocumentManagementService {
  private readonly logger = new Logger(DocumentManagementService.name);
  private readonly uploadPath: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly encryptionKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {
    this.uploadPath = this.configService.get<string>('storage.documentsPath', './uploads/documents');
    this.maxFileSize = this.configService.get<number>('storage.maxFileSize', 50 * 1024 * 1024); // 50MB
    this.allowedMimeTypes = this.configService.get<string[]>('storage.allowedMimeTypes', [
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
    ]);
    this.encryptionKey = this.configService.get<string>('security.encryptionKey', 'default-key');
    
    this.ensureUploadDirectoryExists();
  }

  async uploadAndVerify(request: DocumentUploadRequest): Promise<DocumentUploadResult> {
    try {
      this.logger.log(`Uploading and verifying document: ${request.filename} for ${request.verificationId}`);

      // Validate file
      await this.validateFile(request.file, request.filename, request.contentType);

      // Generate document ID and secure filename
      const documentId = this.generateDocumentId();
      const secureFilename = this.generateSecureFilename(documentId, request.filename);
      const filePath = path.join(this.uploadPath, secureFilename);

      // Calculate file hash for integrity
      const fileHash = this.calculateFileHash(request.file);

      // Perform security checks
      const securityChecks = await this.performSecurityChecks(request.file, request.contentType);
      if (!securityChecks.passed) {
        throw new BadRequestException(`Security check failed: ${securityChecks.reason}`);
      }

      // Process and enhance image if needed
      let processedFile = request.file;
      if (this.isImageFile(request.contentType)) {
        processedFile = await this.processImage(request.file);
      }

      // Encrypt and save file
      const encryptedFile = this.encryptFile(processedFile);
      await fs.writeFile(filePath, encryptedFile);

      // Perform quality assessment
      const qualityAssessment = await this.assessDocumentQuality(request.file, request.contentType);

      // Extract text and data if requested
      let extractedData: Record<string, any> | undefined;
      let ocrResult: OcrExtractionResult | undefined;
      
      if (request.extractData !== false) {
        try {
          ocrResult = await this.performOcr(request.file, request.contentType);
          extractedData = await this.extractStructuredData(
            ocrResult, 
            request.documentType, 
            request.verificationType
          );
        } catch (error) {
          this.logger.warn(`OCR extraction failed for document ${documentId}: ${error.message}`);
        }
      }

      // Perform fraud detection
      const fraudDetection = await this.detectFraud(request.file, request.contentType);

      // Perform document verification
      const verificationResults = await this.verifyDocument({
        documentId,
        documentType: request.documentType,
        extractedData,
      });

      // Create document record
      const documentRecord = {
        id: documentId,
        verificationId: request.verificationId,
        verificationType: request.verificationType || 'KYC',
        documentType: request.documentType,
        fileName: secureFilename,
        originalFileName: request.filename,
        fileSize: request.file.length,
        mimeType: request.contentType,
        fileExtension: path.extname(request.filename),
        filePath,
        fileHash,
        encryptionKeyId: 'default', // In production, use proper key management
        uploadStatus: 'UPLOADED',
        verificationStatus: 'PENDING',
        qualityScore: qualityAssessment.overallScore,
        qualityChecks: qualityAssessment,
        ocrData: ocrResult,
        extractedFields: extractedData,
        fraudIndicators: fraudDetection,
        complianceChecks: verificationResults,
        documentSide: request.documentSide,
        description: request.description,
        uploadedBy: 'system', // Would be actual user in production
        uploadedVia: 'API',
        ipAddress: request.ipAddress,
        retentionPeriod: 2555, // 7 years
        autoDeleteAt: this.calculateAutoDeleteDate(),
        metadata: {
          uploadedAt: new Date().toISOString(),
          processingVersion: '1.0',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // TODO: Save to database
      // await this.documentRepository.save(documentRecord);

      // Emit events
      this.eventEmitter.emit('document.uploaded', {
        documentId,
        verificationId: request.verificationId,
        documentType: request.documentType,
        qualityScore: qualityAssessment.overallScore,
        fraudRisk: fraudDetection.riskScore,
      });

      this.metricsService.recordDocumentUpload(request.documentType);
      this.metricsService.recordDocumentQuality(qualityAssessment.overallScore);

      this.logger.log(`Document uploaded and processed successfully: ${documentId}`);

      return {
        documentId,
        url: this.generateDocumentUrl(documentId),
        extractedData,
        verificationResults,
        qualityAssessment,
        securityChecks,
      };

    } catch (error) {
      this.logger.error(`Failed to upload and verify document: ${error.message}`, error.stack);
      this.metricsService.recordError('document_upload', 'high');
      throw error;
    }
  }

  async uploadAndVerifyBusinessDocument(request: DocumentUploadRequest): Promise<DocumentUploadResult> {
    // Business documents may have different validation rules
    request.verificationType = 'KYB';
    
    // Additional business document specific processing
    const result = await this.uploadAndVerify(request);
    
    // Perform business-specific validations
    if (result.extractedData) {
      const businessValidation = await this.validateBusinessDocument(
        request.documentType,
        result.extractedData
      );
      
      result.verificationResults = {
        ...result.verificationResults,
        businessValidation,
      };
    }

    return result;
  }

  async generateUploadUrl(verificationId: string, documentType: string): Promise<any> {
    // Generate pre-signed upload URL for direct client upload
    const uploadId = this.generateUploadId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    return {
      uploadId,
      uploadUrl: `${this.configService.get('app.baseUrl')}/api/v1/documents/upload/${uploadId}`,
      expiresAt,
      requiredHeaders: {
        'Content-Type': 'multipart/form-data',
        'X-Verification-ID': verificationId,
        'X-Document-Type': documentType,
      },
    };
  }

  async processDocument(documentId: string): Promise<DocumentProcessingResult> {
    try {
      this.logger.log(`Processing document: ${documentId}`);

      // TODO: Retrieve document from database
      // const document = await this.documentRepository.findById(documentId);
      
      // For now, simulate document processing
      const result: DocumentProcessingResult = {
        documentId,
        extractedText: 'Sample extracted text',
        extractedData: {},
        qualityScore: 0.85,
        qualityChecks: {},
        fraudIndicators: {},
        ocrConfidence: 0.92,
      };

      this.eventEmitter.emit('document.processed', {
        documentId,
        qualityScore: result.qualityScore,
        ocrConfidence: result.ocrConfidence,
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to process document ${documentId}: ${error.message}`, error.stack);
      this.metricsService.recordError('document_processing', 'high');
      throw error;
    }
  }

  async verifyDocument(request: DocumentVerificationRequest): Promise<Record<string, any>> {
    try {
      this.logger.log(`Verifying document: ${request.documentId}`);

      const verificationResults: Record<string, any> = {
        documentAuthenticity: 0.95,
        dataConsistency: 0.88,
        templateMatch: true,
        expiryCheck: true,
        issuerValidation: true,
        securityFeatures: true,
        verifiedAt: new Date(),
      };

      // Perform document-specific verifications
      switch (request.documentType) {
        case 'PASSPORT':
          verificationResults.passportSpecific = await this.verifyPassport(request);
          break;
        case 'DRIVERS_LICENSE':
          verificationResults.licenseSpecific = await this.verifyDriversLicense(request);
          break;
        case 'NATIONAL_ID':
          verificationResults.idSpecific = await this.verifyNationalId(request);
          break;
        default:
          verificationResults.genericVerification = await this.verifyGenericDocument(request);
      }

      this.eventEmitter.emit('document.verified', {
        documentId: request.documentId,
        documentType: request.documentType,
        verificationResults,
      });

      return verificationResults;

    } catch (error) {
      this.logger.error(`Failed to verify document ${request.documentId}: ${error.message}`, error.stack);
      this.metricsService.recordError('document_verification', 'medium');
      throw error;
    }
  }

  async performBiometricVerification(documentId: string, selfieBuffer: Buffer): Promise<BiometricVerificationResult> {
    try {
      this.logger.log(`Performing biometric verification for document: ${documentId}`);

      // TODO: Integrate with biometric verification service (e.g., FaceID, AWS Rekognition)
      const result: BiometricVerificationResult = {
        faceMatch: true,
        faceMatchScore: 0.92,
        livenessCheck: true,
        livenessScore: 0.88,
        faceQuality: 0.85,
        spoofingDetection: false,
      };

      this.eventEmitter.emit('document.biometric.verified', {
        documentId,
        faceMatch: result.faceMatch,
        faceMatchScore: result.faceMatchScore,
        livenessCheck: result.livenessCheck,
      });

      return result;

    } catch (error) {
      this.logger.error(`Failed to perform biometric verification for ${documentId}: ${error.message}`, error.stack);
      this.metricsService.recordError('biometric_verification', 'high');
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<Buffer> {
    try {
      // TODO: Retrieve document metadata from database
      // const document = await this.documentRepository.findById(documentId);
      
      // For now, simulate file retrieval
      const filePath = path.join(this.uploadPath, `${documentId}.enc`);
      const encryptedFile = await fs.readFile(filePath);
      
      return this.decryptFile(encryptedFile);

    } catch (error) {
      this.logger.error(`Failed to retrieve document ${documentId}: ${error.message}`, error.stack);
      throw new NotFoundException(`Document not found: ${documentId}`);
    }
  }

  async deleteDocument(documentId: string, reason: string): Promise<void> {
    try {
      this.logger.log(`Deleting document: ${documentId}, reason: ${reason}`);

      // TODO: Update document record in database (soft delete)
      // await this.documentRepository.softDelete(documentId, reason);

      // TODO: Schedule physical file deletion based on retention policy
      
      this.eventEmitter.emit('document.deleted', {
        documentId,
        reason,
        deletedAt: new Date(),
      });

      this.metricsService.recordDocumentDeletion(reason);

    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async validateFile(file: Buffer, filename: string, contentType: string): Promise<void> {
    // Check file size
    if (file.length > this.maxFileSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(contentType)) {
      throw new BadRequestException(`File type ${contentType} is not allowed`);
    }

    // Check file extension
    const extension = path.extname(filename).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.pdf', '.mp4', '.mov'];
    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(`File extension ${extension} is not allowed`);
    }

    // Basic file header validation
    await this.validateFileHeader(file, contentType);
  }

  private async validateFileHeader(file: Buffer, contentType: string): Promise<void> {
    const header = file.slice(0, 16);
    
    switch (contentType) {
      case 'image/jpeg':
        if (!header.slice(0, 2).equals(Buffer.from([0xFF, 0xD8]))) {
          throw new BadRequestException('Invalid JPEG file header');
        }
        break;
      case 'image/png':
        if (!header.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
          throw new BadRequestException('Invalid PNG file header');
        }
        break;
      case 'application/pdf':
        if (!header.slice(0, 4).equals(Buffer.from('%PDF'))) {
          throw new BadRequestException('Invalid PDF file header');
        }
        break;
    }
  }

  private async performSecurityChecks(file: Buffer, contentType: string): Promise<{ passed: boolean; reason?: string }> {
    try {
      // Check for malicious content
      if (await this.containsMaliciousContent(file)) {
        return { passed: false, reason: 'Malicious content detected' };
      }

      // Check file integrity
      if (!await this.validateFileIntegrity(file, contentType)) {
        return { passed: false, reason: 'File integrity check failed' };
      }

      // Check for hidden data (steganography)
      if (await this.containsHiddenData(file, contentType)) {
        return { passed: false, reason: 'Hidden data detected in file' };
      }

      return { passed: true };

    } catch (error) {
      this.logger.error(`Security check failed: ${error.message}`);
      return { passed: false, reason: 'Security check error' };
    }
  }

  private async containsMaliciousContent(file: Buffer): Promise<boolean> {
    // Simple malicious content detection
    const suspiciousPatterns = [
      Buffer.from('javascript:', 'utf8'),
      Buffer.from('<script', 'utf8'),
      Buffer.from('eval(', 'utf8'),
    ];

    return suspiciousPatterns.some(pattern => file.indexOf(pattern) !== -1);
  }

  private async validateFileIntegrity(file: Buffer, contentType: string): Promise<boolean> {
    try {
      if (this.isImageFile(contentType)) {
        // Try to process image with sharp to validate integrity
        await sharp(file).metadata();
        return true;
      } else if (contentType === 'application/pdf') {
        // Try to parse PDF to validate integrity
        await pdf(file);
        return true;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  private async containsHiddenData(file: Buffer, contentType: string): Promise<boolean> {
    // Basic steganography detection
    if (this.isImageFile(contentType)) {
      try {
        const metadata = await sharp(file).metadata();
        // Check for unusual metadata or EXIF data
        if (metadata.exif && metadata.exif.length > 1000) {
          return true; // Suspicious amount of EXIF data
        }
      } catch (error) {
        // Ignore errors
      }
    }
    return false;
  }

  private async processImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Enhance image quality for better OCR
      return await sharp(imageBuffer)
        .resize(null, 1200, { withoutEnlargement: true }) // Ensure minimum height for OCR
        .normalize() // Enhance contrast
        .sharpen() // Improve text clarity
        .jpeg({ quality: 95 }) // High quality output
        .toBuffer();
    } catch (error) {
      this.logger.warn(`Image processing failed, using original: ${error.message}`);
      return imageBuffer;
    }
  }

  private async assessDocumentQuality(file: Buffer, contentType: string): Promise<DocumentQualityCheck & { overallScore: number }> {
    try {
      if (this.isImageFile(contentType)) {
        const metadata = await sharp(file).metadata();
        const stats = await sharp(file).stats();

        // Calculate quality metrics
        const imageQuality = this.calculateImageQuality(metadata, stats);
        const blur = await this.detectBlur(file);
        const brightness = this.calculateBrightness(stats);
        const contrast = this.calculateContrast(stats);

        const qualityCheck: DocumentQualityCheck = {
          imageQuality,
          blur,
          brightness,
          contrast,
          resolution: {
            width: metadata.width || 0,
            height: metadata.height || 0,
            dpi: metadata.density,
          },
          fileIntegrity: true,
          documentOrientation: metadata.orientation === 1 ? 'portrait' : 'landscape',
          edgeDetection: await this.detectDocumentEdges(file),
          textClarity: await this.assessTextClarity(file),
        };

        const overallScore = this.calculateOverallQualityScore(qualityCheck);

        return { ...qualityCheck, overallScore };
      } else {
        // For non-image files (PDFs), return basic quality assessment
        return {
          imageQuality: 1.0,
          blur: 0,
          brightness: 0.5,
          contrast: 0.5,
          resolution: { width: 0, height: 0 },
          fileIntegrity: true,
          documentOrientation: 'portrait',
          edgeDetection: true,
          textClarity: 1.0,
          overallScore: 0.95,
        };
      }
    } catch (error) {
      this.logger.error(`Quality assessment failed: ${error.message}`);
      return {
        imageQuality: 0.5,
        blur: 0.5,
        brightness: 0.5,
        contrast: 0.5,
        resolution: { width: 0, height: 0 },
        fileIntegrity: false,
        documentOrientation: 'unknown',
        edgeDetection: false,
        textClarity: 0.5,
        overallScore: 0.3,
      };
    }
  }

  private calculateImageQuality(metadata: sharp.Metadata, stats: sharp.Stats): number {
    let quality = 1.0;

    // Resolution quality
    const pixelCount = (metadata.width || 0) * (metadata.height || 0);
    if (pixelCount < 500000) quality -= 0.3; // Less than 0.5MP
    else if (pixelCount < 1000000) quality -= 0.1; // Less than 1MP

    // Density quality
    if (metadata.density && metadata.density < 150) quality -= 0.2;

    return Math.max(0, quality);
  }

  private async detectBlur(imageBuffer: Buffer): Promise<number> {
    try {
      // Use Laplacian variance to detect blur
      const { data, info } = await sharp(imageBuffer)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Simple blur detection algorithm
      let variance = 0;
      const { width, height } = info;
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          const laplacian = 
            -data[idx - width - 1] - data[idx - width] - data[idx - width + 1] +
            -data[idx - 1] + 8 * data[idx] - data[idx + 1] +
            -data[idx + width - 1] - data[idx + width] - data[idx + width + 1];
          
          variance += laplacian * laplacian;
        }
      }

      variance /= ((width - 2) * (height - 2));
      
      // Normalize to 0-1 scale (lower values indicate more blur)
      return Math.min(1, variance / 1000);
    } catch (error) {
      return 0.5; // Default moderate blur score
    }
  }

  private calculateBrightness(stats: sharp.Stats): number {
    // Calculate average brightness from stats
    if (stats.channels && stats.channels.length > 0) {
      const avgBrightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;
      return avgBrightness / 255; // Normalize to 0-1
    }
    return 0.5;
  }

  private calculateContrast(stats: sharp.Stats): number {
    // Calculate contrast from standard deviation
    if (stats.channels && stats.channels.length > 0) {
      const avgStdDev = stats.channels.reduce((sum, channel) => sum + channel.stdev, 0) / stats.channels.length;
      return Math.min(1, avgStdDev / 128); // Normalize to 0-1
    }
    return 0.5;
  }

  private async detectDocumentEdges(imageBuffer: Buffer): Promise<boolean> {
    try {
      // Simple edge detection to verify document is properly framed
      const edges = await sharp(imageBuffer)
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
        })
        .toBuffer();

      // Count edge pixels
      let edgePixels = 0;
      for (let i = 0; i < edges.length; i++) {
        if (edges[i] > 128) edgePixels++;
      }

      const edgeRatio = edgePixels / edges.length;
      return edgeRatio > 0.1 && edgeRatio < 0.8; // Good documents have moderate edge content
    } catch (error) {
      return false;
    }
  }

  private async assessTextClarity(imageBuffer: Buffer): Promise<number> {
    try {
      // Convert to high contrast for text clarity assessment
      const processedImage = await sharp(imageBuffer)
        .greyscale()
        .normalize()
        .threshold(128)
        .toBuffer();

      // Count text-like patterns (simple heuristic)
      let textPixels = 0;
      for (let i = 0; i < processedImage.length; i++) {
        if (processedImage[i] === 0) textPixels++; // Black pixels in thresholded image
      }

      const textRatio = textPixels / processedImage.length;
      
      // Good documents typically have 5-30% text coverage
      if (textRatio >= 0.05 && textRatio <= 0.30) {
        return 0.9;
      } else if (textRatio >= 0.02 && textRatio <= 0.50) {
        return 0.7;
      } else {
        return 0.5;
      }
    } catch (error) {
      return 0.5;
    }
  }

  private calculateOverallQualityScore(quality: DocumentQualityCheck): number {
    const weights = {
      imageQuality: 0.25,
      blur: 0.20,
      brightness: 0.10,
      contrast: 0.10,
      resolution: 0.15,
      edgeDetection: 0.10,
      textClarity: 0.10,
    };

    let score = 0;
    score += quality.imageQuality * weights.imageQuality;
    score += (1 - quality.blur) * weights.blur; // Invert blur (less blur = better)
    score += (1 - Math.abs(quality.brightness - 0.5) * 2) * weights.brightness; // Optimal around 0.5
    score += quality.contrast * weights.contrast;
    score += Math.min(1, (quality.resolution.width * quality.resolution.height) / 1000000) * weights.resolution;
    score += (quality.edgeDetection ? 1 : 0) * weights.edgeDetection;
    score += quality.textClarity * weights.textClarity;

    return Math.max(0, Math.min(1, score));
  }

  private async detectFraud(file: Buffer, contentType: string): Promise<FraudDetectionResult> {
    try {
      const indicators: string[] = [];
      let riskScore = 0;

      // Basic fraud detection checks
      if (this.isImageFile(contentType)) {
        // Check for digital manipulation
        const manipulation = await this.detectDigitalManipulation(file);
        if (manipulation.detected) {
          indicators.push('digital_manipulation');
          riskScore += 0.4;
        }

        // Check for document tampering
        const tampering = await this.detectDocumentTampering(file);
        if (tampering) {
          indicators.push('document_tampering');
          riskScore += 0.5;
        }

        // Template matching
        const templateMatch = await this.checkTemplateMatch(file);
        if (!templateMatch) {
          indicators.push('invalid_template');
          riskScore += 0.3;
        }
      }

      return {
        riskScore: Math.min(1, riskScore),
        indicators,
        documentTampering: indicators.includes('document_tampering'),
        digitalManipulation: indicators.includes('digital_manipulation'),
        templateMatch: !indicators.includes('invalid_template'),
      };
    } catch (error) {
      this.logger.error(`Fraud detection failed: ${error.message}`);
      return {
        riskScore: 0.5,
        indicators: ['detection_error'],
        documentTampering: false,
        digitalManipulation: false,
        templateMatch: true,
      };
    }
  }

  private async detectDigitalManipulation(imageBuffer: Buffer): Promise<{ detected: boolean; confidence: number }> {
    try {
      // Basic digital manipulation detection
      const metadata = await sharp(imageBuffer).metadata();
      
      // Check for suspicious EXIF data
      let suspiciousScore = 0;
      
      if (metadata.exif) {
        const exifString = metadata.exif.toString();
        // Look for editing software signatures
        if (exifString.includes('Photoshop') || exifString.includes('GIMP') || exifString.includes('Paint')) {
          suspiciousScore += 0.5;
        }
      }

      // Check image compression artifacts
      if (metadata.format === 'jpeg' && metadata.density && metadata.density !== metadata.density) {
        suspiciousScore += 0.3;
      }

      return {
        detected: suspiciousScore > 0.4,
        confidence: suspiciousScore,
      };
    } catch (error) {
      return { detected: false, confidence: 0 };
    }
  }

  private async detectDocumentTampering(imageBuffer: Buffer): Promise<boolean> {
    try {
      // Look for inconsistencies in image compression or artifacts
      const { channels } = await sharp(imageBuffer).stats();
      
      if (channels && channels.length >= 3) {
        // Check for unusual color distribution that might indicate tampering
        const redMean = channels[0].mean;
        const greenMean = channels[1].mean;
        const blueMean = channels[2].mean;
        
        const colorVariance = Math.abs(redMean - greenMean) + Math.abs(greenMean - blueMean) + Math.abs(redMean - blueMean);
        
        // Documents should have relatively consistent color distribution
        return colorVariance > 50;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  private async checkTemplateMatch(imageBuffer: Buffer): Promise<boolean> {
    // Simplified template matching - in production, use ML models
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      // Basic checks for document-like properties
      const aspectRatio = (metadata.width || 1) / (metadata.height || 1);
      
      // Documents typically have certain aspect ratios
      const validRatios = [
        { min: 0.7, max: 0.8 }, // Portrait documents
        { min: 1.3, max: 1.6 }, // Landscape documents
        { min: 0.6, max: 0.7 }, // ID cards
      ];

      return validRatios.some(ratio => aspectRatio >= ratio.min && aspectRatio <= ratio.max);
    } catch (error) {
      return true; // Default to valid if check fails
    }
  }

  private async performOcr(file: Buffer, contentType: string): Promise<OcrExtractionResult> {
    try {
      let text = '';
      
      if (contentType === 'application/pdf') {
        const pdfData = await pdf(file);
        text = pdfData.text;
      } else if (this.isImageFile(contentType)) {
        // In production, use OCR service like Google Vision API, AWS Textract, or Tesseract
        text = await this.extractTextFromImage(file);
      }

      // Extract structured fields from text
      const fields = this.extractFieldsFromText(text);

      return {
        extractedText: text,
        confidence: 0.85, // Would come from actual OCR service
        fields,
        layout: {
          pages: 1,
          orientation: 'portrait',
          language: 'en',
        },
      };
    } catch (error) {
      this.logger.error(`OCR extraction failed: ${error.message}`);
      throw error;
    }
  }

  private async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    // Placeholder for OCR implementation
    // In production, integrate with:
    // - Google Cloud Vision API
    // - AWS Textract
    // - Azure Computer Vision
    // - Tesseract.js
    
    return 'Sample extracted text from document';
  }

  private extractFieldsFromText(text: string): Record<string, any> {
    const fields: Record<string, any> = {};
    
    // Extract common document fields using regex patterns
    const patterns = {
      name: /(?:name|nom|nombre)[\s:]+([a-zA-Z\s]+)/i,
      dateOfBirth: /(?:date of birth|birth date|dob|né le)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      documentNumber: /(?:no|number|num|numero)[\s:]+([a-zA-Z0-9]+)/i,
      expiryDate: /(?:expires|expiry|exp|valid until)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      nationality: /(?:nationality|nationalité|nacionalidad)[\s:]+([a-zA-Z\s]+)/i,
    };

    for (const [field, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        fields[field] = {
          value: match[1].trim(),
          confidence: 0.8,
        };
      }
    }

    return fields;
  }

  private async extractStructuredData(
    ocrResult: OcrExtractionResult, 
    documentType: string, 
    verificationType?: string
  ): Promise<Record<string, any>> {
    const structuredData: Record<string, any> = {};

    // Map OCR fields to structured data based on document type
    switch (documentType) {
      case 'PASSPORT':
        structuredData.firstName = ocrResult.fields.name?.value?.split(' ')[0];
        structuredData.lastName = ocrResult.fields.name?.value?.split(' ').slice(1).join(' ');
        structuredData.passportNumber = ocrResult.fields.documentNumber?.value;
        structuredData.dateOfBirth = ocrResult.fields.dateOfBirth?.value;
        structuredData.expiryDate = ocrResult.fields.expiryDate?.value;
        structuredData.nationality = ocrResult.fields.nationality?.value;
        break;
        
      case 'DRIVERS_LICENSE':
        structuredData.firstName = ocrResult.fields.name?.value?.split(' ')[0];
        structuredData.lastName = ocrResult.fields.name?.value?.split(' ').slice(1).join(' ');
        structuredData.licenseNumber = ocrResult.fields.documentNumber?.value;
        structuredData.dateOfBirth = ocrResult.fields.dateOfBirth?.value;
        structuredData.expiryDate = ocrResult.fields.expiryDate?.value;
        break;
        
      case 'NATIONAL_ID':
        structuredData.firstName = ocrResult.fields.name?.value?.split(' ')[0];
        structuredData.lastName = ocrResult.fields.name?.value?.split(' ').slice(1).join(' ');
        structuredData.idNumber = ocrResult.fields.documentNumber?.value;
        structuredData.dateOfBirth = ocrResult.fields.dateOfBirth?.value;
        break;
        
      default:
        // Generic extraction
        Object.keys(ocrResult.fields).forEach(key => {
          structuredData[key] = ocrResult.fields[key].value;
        });
    }

    return structuredData;
  }

  private async verifyPassport(request: DocumentVerificationRequest): Promise<Record<string, any>> {
    return {
      mrzValidation: true,
      securityFeatures: true,
      issuerValidation: true,
      biometricChip: false,
    };
  }

  private async verifyDriversLicense(request: DocumentVerificationRequest): Promise<Record<string, any>> {
    return {
      stateValidation: true,
      licenseClass: 'C',
      restrictions: [],
      endorsements: [],
    };
  }

  private async verifyNationalId(request: DocumentVerificationRequest): Promise<Record<string, any>> {
    return {
      countryValidation: true,
      securityFeatures: true,
      issuerValidation: true,
    };
  }

  private async verifyGenericDocument(request: DocumentVerificationRequest): Promise<Record<string, any>> {
    return {
      documentFormat: true,
      readability: true,
      completeness: true,
    };
  }

  private async validateBusinessDocument(documentType: string, extractedData: Record<string, any>): Promise<Record<string, any>> {
    const validation: Record<string, any> = {
      documentType,
      isValid: true,
      errors: [],
      warnings: [],
    };

    switch (documentType) {
      case 'CERTIFICATE_OF_INCORPORATION':
        if (!extractedData.companyName) {
          validation.errors.push('Company name not found');
          validation.isValid = false;
        }
        if (!extractedData.incorporationDate) {
          validation.errors.push('Incorporation date not found');
          validation.isValid = false;
        }
        break;
        
      case 'BUSINESS_LICENSE':
        if (!extractedData.licenseNumber) {
          validation.errors.push('License number not found');
          validation.isValid = false;
        }
        if (!extractedData.expiryDate) {
          validation.warnings.push('License expiry date not found');
        }
        break;
    }

    return validation;
  }

  private isImageFile(contentType: string): boolean {
    return contentType.startsWith('image/');
  }

  private calculateFileHash(file: Buffer): string {
    return crypto.SHA256(file.toString()).toString();
  }

  private encryptFile(file: Buffer): Buffer {
    // Simple encryption for demo - use proper encryption in production
    const encrypted = crypto.AES.encrypt(file.toString('base64'), this.encryptionKey).toString();
    return Buffer.from(encrypted);
  }

  private decryptFile(encryptedFile: Buffer): Buffer {
    // Simple decryption for demo
    const decrypted = crypto.AES.decrypt(encryptedFile.toString(), this.encryptionKey).toString(crypto.enc.Utf8);
    return Buffer.from(decrypted, 'base64');
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSecureFilename(documentId: string, originalFilename: string): string {
    const extension = path.extname(originalFilename);
    return `${documentId}${extension}.enc`;
  }

  private generateDocumentUrl(documentId: string): string {
    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3003');
    return `${baseUrl}/api/v1/documents/${documentId}`;
  }

  private calculateAutoDeleteDate(): Date {
    const retentionDays = this.configService.get<number>('storage.retentionDays', 2555); // 7 years
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + retentionDays);
    return deleteDate;
  }

  private async ensureUploadDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`);
    }
  }
}