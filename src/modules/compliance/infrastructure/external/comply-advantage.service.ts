import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MetricsService } from '@shared/metrics/metrics.service';

export interface ComplyAdvantageSearchRequest {
  entityType: 'person' | 'company';
  name: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  companyNumber?: string;
  jurisdiction?: string;
  exactMatch?: boolean;
  threshold?: number;
}

export interface ComplyAdvantageMatch {
  id: string;
  score: number;
  name: string;
  matchType: 'exact' | 'fuzzy' | 'phonetic';
  categories: string[];
  types: string[];
  sources: string[];
  lastUpdated: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  fields: {
    dateOfBirth?: string;
    placeOfBirth?: string;
    nationality?: string;
    addresses?: string[];
    associates?: string[];
  };
  media?: {
    title: string;
    snippet: string;
    date: string;
    url?: string;
  }[];
}

export interface ComplyAdvantageSearchResponse {
  searchId: string;
  status: 'completed' | 'pending' | 'failed';
  searchTerm: string;
  totalResults: number;
  matches: ComplyAdvantageMatch[];
  summary: {
    sanctionsMatches: number;
    pepMatches: number;
    adverseMediaMatches: number;
    enforcementMatches: number;
    criminalMatches: number;
  };
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'clear' | 'investigate' | 'escalate' | 'block';
}

@Injectable()
export class ComplyAdvantageService {
  private readonly logger = new Logger(ComplyAdvantageService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {
    this.apiUrl = this.configService.get<string>('external.complyAdvantage.apiUrl', 'https://api.complyadvantage.com');
    this.apiKey = this.configService.get<string>('external.complyAdvantage.apiKey', '');
    this.enabled = this.configService.get<boolean>('external.complyAdvantage.enabled', false);
  }

  async searchEntity(request: ComplyAdvantageSearchRequest): Promise<ComplyAdvantageSearchResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        this.logger.warn('ComplyAdvantage service is disabled, returning mock response');
        return this.getMockResponse(request);
      }

      this.logger.log(`Initiating ComplyAdvantage search for: ${request.name}`);

      // Step 1: Perform search
      const searchResult = await this.performSearch(request);

      // Step 2: Get detailed results if needed
      const detailedResults = await this.getDetailedResults(searchResult.searchId);

      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('complyadvantage', 'entity_search', 'success');
      this.metricsService.recordExternalApiResponseTime('complyadvantage', 'entity_search', responseTime);

      this.logger.log(`✅ ComplyAdvantage search completed for: ${request.name}`);
      
      return this.mapComplyAdvantageResponse(detailedResults, request.name);

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('complyadvantage', 'entity_search', 'failure');
      this.metricsService.recordExternalApiResponseTime('complyadvantage', 'entity_search', responseTime);
      
      this.logger.error(`❌ ComplyAdvantage search failed for ${request.name}:`, error);
      
      return {
        searchId: `failed_${Date.now()}`,
        status: 'failed',
        searchTerm: request.name,
        totalResults: 0,
        matches: [],
        summary: {
          sanctionsMatches: 0,
          pepMatches: 0,
          adverseMediaMatches: 0,
          enforcementMatches: 0,
          criminalMatches: 0,
        },
        overallRisk: 'low',
        recommendedAction: 'investigate',
      };
    }
  }

  async performSearch(request: ComplyAdvantageSearchRequest): Promise<any> {
    try {
      const searchParams: any = {
        search_term: request.name,
        type: request.entityType,
        exact_match: request.exactMatch || false,
        threshold: request.threshold || 0.7,
        limit: 100,
        offset: 0,
      };

      if (request.dateOfBirth) {
        searchParams.birth_year = new Date(request.dateOfBirth).getFullYear();
      }

      if (request.nationality) {
        searchParams.nationality = request.nationality;
      }

      if (request.companyNumber) {
        searchParams.company_number = request.companyNumber;
      }

      if (request.jurisdiction) {
        searchParams.jurisdiction = request.jurisdiction;
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/searches`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            params: searchParams,
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to perform ComplyAdvantage search:', error);
      throw error;
    }
  }

  async getDetailedResults(searchId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/searches/${searchId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get detailed ComplyAdvantage results:', error);
      throw error;
    }
  }

  async monitorEntity(entityId: string, searchTerm: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        return true; // Mock success
      }

      this.logger.log(`Setting up ComplyAdvantage monitoring for entity: ${entityId}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/monitoring`,
          {
            entity_id: entityId,
            search_term: searchTerm,
            frequency: 'daily',
            auto_review: false,
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
      this.metricsService.recordExternalApiCall('complyadvantage', 'monitoring_setup', 'success');
      this.metricsService.recordExternalApiResponseTime('complyadvantage', 'monitoring_setup', responseTime);

      return response.status === 200 || response.status === 201;

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('complyadvantage', 'monitoring_setup', 'failure');
      this.metricsService.recordExternalApiResponseTime('complyadvantage', 'monitoring_setup', responseTime);
      
      this.logger.error(`Failed to set up ComplyAdvantage monitoring for entity ${entityId}:`, error);
      return false;
    }
  }

  async getAdverseMedia(entityName: string, limit: number = 50): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      if (!this.enabled) {
        return this.getMockAdverseMedia(entityName);
      }

      this.logger.log(`Searching ComplyAdvantage adverse media for: ${entityName}`);

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/adverse-media`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
            params: {
              search_term: entityName,
              limit,
              offset: 0,
            },
          },
        ),
      );

      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('complyadvantage', 'adverse_media', 'success');
      this.metricsService.recordExternalApiResponseTime('complyadvantage', 'adverse_media', responseTime);

      return response.data.results || [];

    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      this.metricsService.recordExternalApiCall('complyadvantage', 'adverse_media', 'failure');
      this.metricsService.recordExternalApiResponseTime('complyadvantage', 'adverse_media', responseTime);
      
      this.logger.error(`Failed to get adverse media for ${entityName}:`, error);
      return [];
    }
  }

  private mapComplyAdvantageResponse(caData: any, searchTerm: string): ComplyAdvantageSearchResponse {
    const matches = this.extractMatches(caData);
    const summary = this.calculateSummary(matches);
    const overallRisk = this.determineOverallRisk(matches);
    const recommendedAction = this.determineRecommendedAction(matches, overallRisk);

    return {
      searchId: caData.id || `ca_${Date.now()}`,
      status: 'completed',
      searchTerm,
      totalResults: caData.total || matches.length,
      matches,
      summary,
      overallRisk,
      recommendedAction,
    };
  }

  private extractMatches(caData: any): ComplyAdvantageMatch[] {
    const matches: ComplyAdvantageMatch[] = [];
    const results = caData.results || [];

    results.forEach((result: any, index: number) => {
      if (result.score >= 0.5) { // Only include meaningful matches
        matches.push({
          id: result.id || `ca_match_${index}`,
          score: result.score || 0.5,
          name: result.name || 'Unknown',
          matchType: this.determineMatchType(result.score),
          categories: result.categories || [],
          types: result.types || [],
          sources: result.sources || ['ComplyAdvantage'],
          lastUpdated: result.last_updated_utc || new Date().toISOString(),
          riskLevel: this.determineRiskLevel(result),
          fields: {
            dateOfBirth: result.birth_year ? `${result.birth_year}-01-01` : undefined,
            placeOfBirth: result.place_of_birth,
            nationality: result.nationality,
            addresses: result.addresses || [],
            associates: result.associates || [],
          },
          media: this.extractMedia(result.media || []),
        });
      }
    });

    return matches;
  }

  private determineMatchType(score: number): 'exact' | 'fuzzy' | 'phonetic' {
    if (score >= 0.95) return 'exact';
    if (score >= 0.8) return 'fuzzy';
    return 'phonetic';
  }

  private determineRiskLevel(result: any): 'low' | 'medium' | 'high' | 'critical' {
    const categories = result.categories || [];
    const types = result.types || [];
    
    if (categories.includes('sanctions') || types.includes('sanctions')) {
      return 'critical';
    }
    if (categories.includes('pep') || types.includes('pep')) {
      return 'high';
    }
    if (categories.includes('adverse-media') || result.score >= 0.8) {
      return 'medium';
    }
    return 'low';
  }

  private extractMedia(mediaArray: any[]): any[] {
    return mediaArray.slice(0, 10).map(media => ({
      title: media.title || 'No title',
      snippet: media.snippet || media.description || '',
      date: media.date || media.published_date || new Date().toISOString(),
      url: media.url,
    }));
  }

  private calculateSummary(matches: ComplyAdvantageMatch[]): any {
    return {
      sanctionsMatches: matches.filter(m => 
        m.categories.some(cat => cat.toLowerCase().includes('sanction')) ||
        m.types.some(type => type.toLowerCase().includes('sanction'))
      ).length,
      pepMatches: matches.filter(m => 
        m.categories.some(cat => cat.toLowerCase().includes('pep')) ||
        m.types.some(type => type.toLowerCase().includes('pep'))
      ).length,
      adverseMediaMatches: matches.filter(m => 
        m.categories.some(cat => cat.toLowerCase().includes('adverse')) ||
        m.media && m.media.length > 0
      ).length,
      enforcementMatches: matches.filter(m => 
        m.categories.some(cat => cat.toLowerCase().includes('enforcement')) ||
        m.types.some(type => type.toLowerCase().includes('enforcement'))
      ).length,
      criminalMatches: matches.filter(m => 
        m.categories.some(cat => cat.toLowerCase().includes('criminal')) ||
        m.types.some(type => type.toLowerCase().includes('criminal'))
      ).length,
    };
  }

  private determineOverallRisk(matches: ComplyAdvantageMatch[]): 'low' | 'medium' | 'high' | 'critical' {
    if (matches.some(m => m.riskLevel === 'critical')) return 'critical';
    if (matches.some(m => m.riskLevel === 'high')) return 'high';
    if (matches.some(m => m.riskLevel === 'medium')) return 'medium';
    return 'low';
  }

  private determineRecommendedAction(matches: ComplyAdvantageMatch[], overallRisk: string): 'clear' | 'investigate' | 'escalate' | 'block' {
    if (overallRisk === 'critical') return 'block';
    if (overallRisk === 'high') return 'escalate';
    if (overallRisk === 'medium' || matches.length > 0) return 'investigate';
    return 'clear';
  }

  private getMockResponse(request: ComplyAdvantageSearchRequest): ComplyAdvantageSearchResponse {
    const hasMatch = Math.random() < 0.12; // 12% chance of finding matches
    
    if (!hasMatch) {
      return {
        searchId: `mock_ca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'completed',
        searchTerm: request.name,
        totalResults: 0,
        matches: [],
        summary: {
          sanctionsMatches: 0,
          pepMatches: 0,
          adverseMediaMatches: 0,
          enforcementMatches: 0,
          criminalMatches: 0,
        },
        overallRisk: 'low',
        recommendedAction: 'clear',
      };
    }

    const mockMatches: ComplyAdvantageMatch[] = [
      {
        id: 'mock_ca_match_1',
        score: 0.72,
        name: `${request.name} (Potential Match)`,
        matchType: 'fuzzy',
        categories: ['adverse-media'],
        types: ['person'],
        sources: ['ComplyAdvantage', 'News Media'],
        lastUpdated: new Date().toISOString(),
        riskLevel: 'medium',
        fields: {
          nationality: request.nationality,
          addresses: ['Various locations'],
        },
        media: [
          {
            title: 'Business Investigation Article',
            snippet: 'This entity was mentioned in a business context...',
            date: '2024-01-15',
          },
        ],
      },
    ];

    return {
      searchId: `mock_ca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      searchTerm: request.name,
      totalResults: 1,
      matches: mockMatches,
      summary: {
        sanctionsMatches: 0,
        pepMatches: 0,
        adverseMediaMatches: 1,
        enforcementMatches: 0,
        criminalMatches: 0,
      },
      overallRisk: 'medium',
      recommendedAction: 'investigate',
    };
  }

  private getMockAdverseMedia(entityName: string): any[] {
    return [
      {
        title: 'Sample Business Article',
        snippet: `Article mentioning ${entityName} in business context`,
        date: '2024-01-15',
        url: 'https://example.com/article',
      },
    ];
  }
}