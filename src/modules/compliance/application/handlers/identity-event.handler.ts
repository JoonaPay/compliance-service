import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { KycService } from '../domain/services/kyc.service';
import { ComplianceRulesService } from '../domain/services/compliance-rules.service';
import { KafkaService } from '@shared/kafka/kafka.service';
import { MetricsService } from '@shared/metrics/metrics.service';
import { KycLevel } from '../domain/entities/kyc-verification.entity';

export interface IdentityUserCreatedEvent {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  preferredCurrency?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface IdentityUserUpdatedEvent {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  preferredCurrency?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface IdentityUserDeletedEvent {
  userId: string;
  email: string;
  timestamp: string;
}

export interface IdentityUserLoginEvent {
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country: string;
    city?: string;
  };
  timestamp: string;
}

@Injectable()
export class IdentityEventHandler {
  private readonly logger = new Logger(IdentityEventHandler.name);

  constructor(
    private readonly kycService: KycService,
    private readonly complianceRulesService: ComplianceRulesService,
    private readonly kafkaService: KafkaService,
    private readonly metricsService: MetricsService,
  ) {}

  @OnEvent('identity.user.created')
  async handleUserCreated(event: IdentityUserCreatedEvent) {
    try {
      this.logger.log(`Processing user created event for: ${event.userId}`);

      // Determine KYC level based on user risk level and nationality
      const kycLevel = this.determineKycLevel(event);

      // Auto-initiate KYC for new users (configurable policy)
      if (this.shouldAutoInitiateKyc(event)) {
        await this.kycService.initiateKyc({
          userId: event.userId,
          level: kycLevel,
          provider: 'jumio', // Default provider
          metadata: {
            autoInitiated: true,
            source: 'user_registration',
            userEmail: event.email,
            riskLevel: event.riskLevel,
            ...event.metadata,
          },
        });

        this.logger.log(`✅ Auto-initiated KYC for user: ${event.userId} at level: ${kycLevel}`);
      }

      // Check for geographic restrictions
      if (event.nationality) {
        const geoComplianceResult = await this.checkGeographicRestrictions(event);
        if (!geoComplianceResult.allowed) {
          await this.kafkaService.publishComplianceAlert({
            type: 'geographic_restriction',
            userId: event.userId,
            severity: 'high',
            description: 'User from restricted jurisdiction',
            details: {
              nationality: event.nationality,
              restrictions: geoComplianceResult.restrictions,
            },
          });
        }
      }

      // Publish compliance event for other services
      await this.kafkaService.publishComplianceEvent('user.onboarded', {
        userId: event.userId,
        email: event.email,
        kycLevel,
        autoKycInitiated: this.shouldAutoInitiateKyc(event),
        riskLevel: event.riskLevel,
      });

      this.metricsService.recordComplianceOperation('user_onboarded', 'success');

    } catch (error) {
      this.logger.error(`❌ Failed to process user created event for ${event.userId}:`, error);
      this.metricsService.recordComplianceOperation('user_onboarded', 'failure');
      this.metricsService.recordError('user_onboarding', 'high');
    }
  }

  @OnEvent('identity.user.updated')
  async handleUserUpdated(event: IdentityUserUpdatedEvent) {
    try {
      this.logger.log(`Processing user updated event for: ${event.userId}`);

      // Check if risk level changed
      if (event.riskLevel) {
        const existingKycs = await this.kycService.getUserKycVerifications(event.userId);
        const hasApprovedKyc = existingKycs.some(kyc => kyc.isApproved());

        // If user risk increased and they don't have appropriate KYC level
        if (event.riskLevel === 'high' && !hasApprovedKyc) {
          await this.kycService.initiateKyc({
            userId: event.userId,
            level: KycLevel.ENHANCED,
            provider: 'jumio',
            metadata: {
              autoInitiated: true,
              source: 'risk_level_change',
              previousRiskLevel: 'medium', // Would be tracked
              newRiskLevel: event.riskLevel,
            },
          });

          this.logger.log(`✅ Initiated enhanced KYC due to risk level change for user: ${event.userId}`);
        }
      }

      // Check for nationality changes that might trigger compliance reviews
      if (event.nationality) {
        const geoComplianceResult = await this.checkGeographicRestrictions(event);
        if (!geoComplianceResult.allowed) {
          await this.kafkaService.publishComplianceAlert({
            type: 'nationality_change_restriction',
            userId: event.userId,
            severity: 'high',
            description: 'User updated nationality to restricted jurisdiction',
            details: {
              newNationality: event.nationality,
              restrictions: geoComplianceResult.restrictions,
            },
          });
        }
      }

      this.metricsService.recordComplianceOperation('user_updated', 'success');

    } catch (error) {
      this.logger.error(`❌ Failed to process user updated event for ${event.userId}:`, error);
      this.metricsService.recordComplianceOperation('user_updated', 'failure');
      this.metricsService.recordError('user_update_processing', 'medium');
    }
  }

  @OnEvent('identity.user.deleted')
  async handleUserDeleted(event: IdentityUserDeletedEvent) {
    try {
      this.logger.log(`Processing user deleted event for: ${event.userId}`);

      // Archive compliance records (don't delete due to regulatory requirements)
      const kycVerifications = await this.kycService.getUserKycVerifications(event.userId);
      
      if (kycVerifications.length > 0) {
        this.logger.log(`⚠️ User ${event.userId} deleted with ${kycVerifications.length} KYC records - archiving for compliance`);
        
        // Publish event for compliance record archival
        await this.kafkaService.publishComplianceEvent('user.compliance.archived', {
          userId: event.userId,
          email: event.email,
          kycRecords: kycVerifications.length,
          archivedAt: new Date().toISOString(),
          retentionPeriod: '7_years', // Regulatory requirement
        });
      }

      this.metricsService.recordComplianceOperation('user_deleted', 'success');

    } catch (error) {
      this.logger.error(`❌ Failed to process user deleted event for ${event.userId}:`, error);
      this.metricsService.recordComplianceOperation('user_deleted', 'failure');
      this.metricsService.recordError('user_deletion_processing', 'medium');
    }
  }

  @OnEvent('identity.user.login')
  async handleUserLogin(event: IdentityUserLoginEvent) {
    try {
      this.logger.log(`Processing user login event for: ${event.userId}`);

      // Check for geographic anomalies in login location
      if (event.location?.country) {
        const isHighRiskLocation = await this.checkHighRiskLocation(event.location.country);
        
        if (isHighRiskLocation) {
          await this.kafkaService.publishComplianceAlert({
            type: 'suspicious_login_location',
            userId: event.userId,
            severity: 'medium',
            description: 'User login from high-risk jurisdiction',
            details: {
              location: event.location,
              ipAddress: event.ipAddress,
              userAgent: event.userAgent,
              timestamp: event.timestamp,
            },
          });
        }
      }

      // Check if user has required KYC for login
      const kycVerifications = await this.kycService.getUserKycVerifications(event.userId);
      const hasValidKyc = kycVerifications.some(kyc => kyc.isApproved());

      if (!hasValidKyc) {
        this.logger.log(`⚠️ User ${event.userId} login without valid KYC - may need verification`);
        
        await this.kafkaService.publishComplianceEvent('user.login.kyc_required', {
          userId: event.userId,
          email: event.email,
          location: event.location,
          kycStatus: 'required',
        });
      }

      this.metricsService.recordComplianceOperation('user_login_checked', 'success');

    } catch (error) {
      this.logger.error(`❌ Failed to process user login event for ${event.userId}:`, error);
      this.metricsService.recordComplianceOperation('user_login_checked', 'failure');
      this.metricsService.recordError('user_login_processing', 'low');
    }
  }

  private determineKycLevel(event: IdentityUserCreatedEvent): KycLevel {
    // Determine KYC level based on various factors
    if (event.riskLevel === 'high') {
      return KycLevel.ENHANCED;
    }
    
    if (event.nationality && this.isHighRiskCountry(event.nationality)) {
      return KycLevel.ENHANCED;
    }
    
    if (event.riskLevel === 'medium') {
      return KycLevel.STANDARD;
    }
    
    return KycLevel.BASIC;
  }

  private shouldAutoInitiateKyc(event: IdentityUserCreatedEvent): boolean {
    // Business logic to determine if KYC should be auto-initiated
    // This could be configurable per jurisdiction or user type
    
    // Always initiate for high-risk users
    if (event.riskLevel === 'high') {
      return true;
    }
    
    // Auto-initiate for users from certain countries
    if (event.nationality && this.isHighRiskCountry(event.nationality)) {
      return true;
    }
    
    // Auto-initiate for medium risk users (configurable policy)
    if (event.riskLevel === 'medium') {
      return true;
    }
    
    // For low-risk users, might defer KYC until first transaction
    return false;
  }

  private async checkGeographicRestrictions(event: { nationality?: string }): Promise<{ allowed: boolean; restrictions?: string[] }> {
    const restrictedCountries = [
      'North Korea', 'Iran', 'Syria', 'Afghanistan', 'Somalia',
      'Yemen', 'Libya', 'Iraq', 'Venezuela', 'Myanmar', 'Belarus'
    ];

    if (!event.nationality) {
      return { allowed: true };
    }

    const isRestricted = restrictedCountries.some(country => 
      event.nationality!.toLowerCase().includes(country.toLowerCase())
    );

    if (isRestricted) {
      return {
        allowed: false,
        restrictions: ['sanctions', 'regulatory_prohibition'],
      };
    }

    return { allowed: true };
  }

  private async checkHighRiskLocation(country: string): Promise<boolean> {
    const highRiskCountries = [
      'Afghanistan', 'Albania', 'Angola', 'Antigua and Barbuda', 'Argentina',
      'Armenia', 'Bahamas', 'Barbados', 'Belarus', 'Botswana', 'Burma',
      'Burkina Faso', 'Cambodia', 'Cameroon', 'Cayman Islands', 'China',
      'Democratic Republic of Congo', 'Cuba', 'Gibraltar', 'Haiti', 'Iran',
      'Iraq', 'Jamaica', 'Jordan', 'Laos', 'Libya', 'Mali', 'Morocco',
      'Mozambique', 'Nicaragua', 'Nigeria', 'North Korea', 'Pakistan',
      'Panama', 'Philippines', 'Russia', 'Senegal', 'Somalia', 'South Sudan',
      'Sudan', 'Syria', 'Tanzania', 'Trinidad and Tobago', 'Turkey',
      'Uganda', 'United Arab Emirates', 'Venezuela', 'Yemen', 'Zimbabwe'
    ];

    return highRiskCountries.some(riskCountry => 
      country.toLowerCase().includes(riskCountry.toLowerCase())
    );
  }

  private isHighRiskCountry(nationality: string): boolean {
    // Same logic as checkHighRiskLocation but for nationality
    const highRiskNationalities = [
      'North Korean', 'Iranian', 'Syrian', 'Afghan', 'Somali',
      'Yemeni', 'Libyan', 'Iraqi', 'Venezuelan', 'Myanmar', 'Belarusian'
    ];

    return highRiskNationalities.some(riskNationality => 
      nationality.toLowerCase().includes(riskNationality.toLowerCase())
    );
  }
}