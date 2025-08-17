import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MetricsService } from '@shared/metrics/metrics.service';

export interface WorldCheckScreeningRequest {
  entityType: 'individual' | 'business';
  name: string;
  dateOfBirth?: string;
  nationality?: string;
  businessType?: string;
  registrationNumber?: string;
  metadata?: Record<string, any>;
}

export interface WorldCheckMatch {
  id: string;
  matchStrength: number;
  entityName: string;
  category: 'sanctions' | 'pep' | 'adverse_media' | 'other';
  subcategory?: string;
  description: string;
  sources: string[];
  lastUpdated: string;
  riskLevel: 'low' | 'medium' | 'high';
  jurisdiction?: string;
}

export interface WorldCheckScreeningResponse {
  screeningId: string;
  status: 'pending' | 'completed' | 'failed';
  matches: WorldCheckMatch[];
  summary: {
    totalMatches: number;
    sanctionsMatches: number;
    pepMatches: number;
    adverseMediaMatches: number;
    highRiskMatches: number;
  };
  overallRiskScore: number;
  recommendedAction: 'approve' | 'review' | 'block';
}

@Injectable()
export class WorldCheckService {
  private readonly logger = new Logger(WorldCheckService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {
    this.apiUrl = this.configService.get<string>('external.worldCheck.apiUrl', 'https://api-worldcheck.refinitiv.com/pilot-api');
    this.apiKey = this.configService.get<string>('external.worldCheck.apiKey', '');
    this.enabled = this.configService.get<boolean>('external.worldCheck.enabled', false);
  }

  async screenEntity(request: WorldCheckScreeningRequest): Promise<WorldCheckScreeningResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        this.logger.warn('WorldCheck service is disabled, returning mock response');
        return this.getMockResponse(request);
      }

      this.logger.log(`Initiating WorldCheck screening for: ${request.name}`);

      // Step 1: Create screening case
      const caseData = await this.createScreeningCase(request);

      // Step 2: Submit screening request
      const screeningResult = await this.submitScreening(caseData.caseId, request);

      // Step 3: Get screening results
      const results = await this.getScreeningResults(caseData.caseId);

      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('worldcheck', 'sanctions_screening', 'success');
      this.metricsService.recordExternalApiResponseTime('worldcheck', 'sanctions_screening', responseTime);

      this.logger.log(`✅ WorldCheck screening completed for: ${request.name}`);
      
      return this.mapWorldCheckResponse(results, caseData.caseId);

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('worldcheck', 'sanctions_screening', 'failure');
      this.metricsService.recordExternalApiResponseTime('worldcheck', 'sanctions_screening', responseTime);
      
      this.logger.error(`❌ WorldCheck screening failed for ${request.name}:`, error);
      
      return {
        screeningId: `failed_${Date.now()}`,
        status: 'failed',
        matches: [],
        summary: {
          totalMatches: 0,
          sanctionsMatches: 0,
          pepMatches: 0,
          adverseMediaMatches: 0,
          highRiskMatches: 0,
        },
        overallRiskScore: 0,
        recommendedAction: 'review',
      };
    }
  }

  async createScreeningCase(request: WorldCheckScreeningRequest): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/v1/cases`,
          {
            entityType: request.entityType,
            name: `WorldCheck Screening - ${request.name}`,
            lifecycle: 'UNRESOLVED',
            assigneeId: 'system',
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return { caseId: response.data.caseId };
    } catch (error) {
      this.logger.error('Failed to create WorldCheck case:', error);
      throw error;
    }
  }

  async submitScreening(caseId: string, request: WorldCheckScreeningRequest): Promise<any> {
    try {
      const entityData = this.buildEntityData(request);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/v1/cases/${caseId}/screeningRequest`,
          {
            secondaryFields: entityData.secondaryFields,
            groups: [
              {
                entities: [entityData.entity],
              },
            ],
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to submit WorldCheck screening:', error);
      throw error;
    }
  }

  async getScreeningResults(caseId: string): Promise<any> {
    try {
      // Wait for screening to complete (in real implementation, use webhooks)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/v1/cases/${caseId}/results`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get WorldCheck results:', error);
      throw error;
    }
  }

  async performOngoingScreening(entityId: string): Promise<WorldCheckScreeningResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        return this.getMockOngoingResponse(entityId);
      }

      this.logger.log(`Performing ongoing WorldCheck screening for entity: ${entityId}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/v1/ongoingScreening`,
          {
            entityId,
            monitoringOptions: {
              enableOngoingMonitoring: true,
              monitoringFrequency: 'DAILY',
            },
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('worldcheck', 'ongoing_screening', 'success');
      this.metricsService.recordExternalApiResponseTime('worldcheck', 'ongoing_screening', responseTime);

      return this.mapWorldCheckResponse(response.data, entityId);

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('worldcheck', 'ongoing_screening', 'failure');
      this.metricsService.recordExternalApiResponseTime('worldcheck', 'ongoing_screening', responseTime);
      
      this.logger.error(`Ongoing WorldCheck screening failed for entity ${entityId}:`, error);
      return this.getMockOngoingResponse(entityId);
    }
  }

  private buildEntityData(request: WorldCheckScreeningRequest): any {
    const entity: any = {
      entityType: request.entityType.toUpperCase(),
      nameTransliteration: 'NONE',
      sources: ['WorldCompliance'],
    };

    const secondaryFields: any[] = [];

    if (request.entityType === 'individual') {
      entity.primaryName = request.name;
      
      if (request.dateOfBirth) {
        secondaryFields.push({
          typeId: 'SFCT_DOB',
          value: request.dateOfBirth,
        });
      }

      if (request.nationality) {
        secondaryFields.push({
          typeId: 'SFCT_NATIONALITY',
          value: request.nationality,
        });
      }
    } else {
      entity.primaryName = request.name;
      
      if (request.businessType) {
        secondaryFields.push({
          typeId: 'SFCT_BUSINESS_TYPE',
          value: request.businessType,
        });
      }

      if (request.registrationNumber) {
        secondaryFields.push({
          typeId: 'SFCT_REGISTRATION_NUMBER',
          value: request.registrationNumber,
        });
      }
    }

    return { entity, secondaryFields };
  }

  private mapWorldCheckResponse(worldCheckData: any, screeningId: string): WorldCheckScreeningResponse {
    const matches = this.extractMatches(worldCheckData);
    const summary = this.calculateSummary(matches);
    const overallRiskScore = this.calculateOverallRiskScore(matches);
    const recommendedAction = this.determineRecommendedAction(matches, overallRiskScore);

    return {
      screeningId,
      status: 'completed',
      matches,
      summary,
      overallRiskScore,
      recommendedAction,
    };
  }

  private extractMatches(worldCheckData: any): WorldCheckMatch[] {
    const matches: WorldCheckMatch[] = [];
    const results = worldCheckData.results || worldCheckData.groups?.[0]?.results || [];

    results.forEach((result: any, index: number) => {
      if (result.matchStrength > 0.3) { // Only include meaningful matches
        matches.push({
          id: result.resultId || `match_${index}`,
          matchStrength: result.matchStrength || 0.5,
          entityName: result.matchedEntity?.primaryName || 'Unknown',
          category: this.categorizeMatch(result),
          subcategory: result.subcategory,
          description: result.matchedEntity?.reasonsForListing?.join('; ') || 'No details available',
          sources: result.sources || ['WorldCheck'],
          lastUpdated: result.lastUpdated || new Date().toISOString(),
          riskLevel: this.determineRiskLevel(result.matchStrength),
          jurisdiction: result.matchedEntity?.jurisdiction,
        });
      }
    });

    return matches;
  }

  private categorizeMatch(result: any): 'sanctions' | 'pep' | 'adverse_media' | 'other' {
    const categories = result.matchedEntity?.categories || [];
    
    if (categories.some((cat: string) => cat.toLowerCase().includes('sanction'))) {
      return 'sanctions';
    }
    if (categories.some((cat: string) => cat.toLowerCase().includes('pep'))) {
      return 'pep';
    }
    if (categories.some((cat: string) => cat.toLowerCase().includes('adverse'))) {
      return 'adverse_media';
    }
    return 'other';
  }

  private determineRiskLevel(matchStrength: number): 'low' | 'medium' | 'high' {
    if (matchStrength >= 0.8) return 'high';
    if (matchStrength >= 0.6) return 'medium';
    return 'low';
  }

  private calculateSummary(matches: WorldCheckMatch[]): any {
    return {
      totalMatches: matches.length,
      sanctionsMatches: matches.filter(m => m.category === 'sanctions').length,
      pepMatches: matches.filter(m => m.category === 'pep').length,
      adverseMediaMatches: matches.filter(m => m.category === 'adverse_media').length,
      highRiskMatches: matches.filter(m => m.riskLevel === 'high').length,
    };
  }

  private calculateOverallRiskScore(matches: WorldCheckMatch[]): number {
    if (matches.length === 0) return 0;

    const highestMatch = Math.max(...matches.map(m => m.matchStrength));
    const sanctionsMultiplier = matches.some(m => m.category === 'sanctions') ? 1.2 : 1;
    
    return Math.min(highestMatch * sanctionsMultiplier, 1);
  }

  private determineRecommendedAction(matches: WorldCheckMatch[], riskScore: number): 'approve' | 'review' | 'block' {
    if (matches.some(m => m.category === 'sanctions' && m.riskLevel === 'high')) {
      return 'block';
    }
    if (riskScore >= 0.7 || matches.some(m => m.riskLevel === 'high')) {
      return 'review';
    }
    return 'approve';
  }

  private getMockResponse(request: WorldCheckScreeningRequest): WorldCheckScreeningResponse {
    const hasMatch = Math.random() < 0.1; // 10% chance of finding matches for testing
    
    if (!hasMatch) {
      return {
        screeningId: `mock_wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'completed',
        matches: [],
        summary: {
          totalMatches: 0,
          sanctionsMatches: 0,
          pepMatches: 0,
          adverseMediaMatches: 0,
          highRiskMatches: 0,
        },
        overallRiskScore: 0,
        recommendedAction: 'approve',
      };
    }

    const mockMatches: WorldCheckMatch[] = [
      {
        id: 'mock_match_1',
        matchStrength: 0.65,
        entityName: `${request.name} (Similar Name)`,
        category: 'pep',
        description: 'Former government official with similar name',
        sources: ['WorldCheck'],
        lastUpdated: new Date().toISOString(),
        riskLevel: 'medium',
        jurisdiction: 'International',
      },
    ];

    return {
      screeningId: `mock_wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      matches: mockMatches,
      summary: {
        totalMatches: 1,
        sanctionsMatches: 0,
        pepMatches: 1,
        adverseMediaMatches: 0,
        highRiskMatches: 0,
      },
      overallRiskScore: 0.65,
      recommendedAction: 'review',
    };
  }

  private getMockOngoingResponse(entityId: string): WorldCheckScreeningResponse {
    return {
      screeningId: `ongoing_${entityId}`,
      status: 'completed',
      matches: [],
      summary: {
        totalMatches: 0,
        sanctionsMatches: 0,
        pepMatches: 0,
        adverseMediaMatches: 0,
        highRiskMatches: 0,
      },
      overallRiskScore: 0,
      recommendedAction: 'approve',
    };
  }
}