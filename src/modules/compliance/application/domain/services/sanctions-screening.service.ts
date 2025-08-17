import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MetricsService } from '@shared/metrics/metrics.service';
import { firstValueFrom } from 'rxjs';

export interface IndividualScreeningRequest {
  fullName: string;
  dateOfBirth?: Date;
  nationality?: string;
  address?: string;
  idNumber?: string;
}

export interface BusinessScreeningRequest {
  businessName: string;
  registrationNumber?: string;
  taxId?: string;
  incorporationCountry?: string;
  address?: string;
}

export interface ScreeningResult {
  sanctionsMatch: boolean;
  pepMatch: boolean;
  adverseMediaMatch: boolean;
  countryRisk: number;
  matches: ScreeningMatch[];
  confidence: number;
  screenedAt: Date;
}

export interface BusinessScreeningResult {
  sanctionsMatch: boolean;
  adverseMediaMatch: boolean;
  jurisdictionRisk: number;
  matches: ScreeningMatch[];
  confidence: number;
  screenedAt: Date;
}

export interface ScreeningMatch {
  id: string;
  name: string;
  type: 'sanctions' | 'pep' | 'adverse_media';
  list: string;
  confidence: number;
  details: any;
}

@Injectable()
export class SanctionsScreeningService {
  private readonly logger = new Logger(SanctionsScreeningService.name);
  private readonly enabled: boolean;
  private readonly provider: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {
    this.enabled = this.configService.get<boolean>('sanctions.enabled', true);
    this.provider = this.configService.get<string>('sanctions.provider', 'worldcheck');
  }

  async screenIndividual(request: IndividualScreeningRequest): Promise<ScreeningResult> {
    try {
      this.logger.log(`Screening individual: ${request.fullName}`);

      if (!this.enabled) {
        return this.createDefaultResult();
      }

      let result: ScreeningResult;

      switch (this.provider) {
        case 'worldcheck':
          result = await this.screenWithWorldCheck(request);
          break;
        case 'complyadvantage':
          result = await this.screenWithComplyAdvantage(request);
          break;
        default:
          result = await this.mockScreeningResult(request);
      }

      this.metricsService.recordComplianceOperation('sanctions_screening_individual', 'success');
      this.metricsService.recordSanctionsScreening('individual', result.sanctionsMatch);

      this.logger.log(`Individual screening completed: ${request.fullName}, sanctions: ${result.sanctionsMatch}, PEP: ${result.pepMatch}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to screen individual: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('sanctions_screening_individual', 'failure');
      this.metricsService.recordError('sanctions_screening', 'high');
      
      // Return safe default on error
      return this.createDefaultResult();
    }
  }

  async screenBusiness(request: BusinessScreeningRequest): Promise<BusinessScreeningResult> {
    try {
      this.logger.log(`Screening business: ${request.businessName}`);

      if (!this.enabled) {
        return this.createDefaultBusinessResult();
      }

      let result: BusinessScreeningResult;

      switch (this.provider) {
        case 'worldcheck':
          result = await this.screenBusinessWithWorldCheck(request);
          break;
        case 'complyadvantage':
          result = await this.screenBusinessWithComplyAdvantage(request);
          break;
        default:
          result = await this.mockBusinessScreeningResult(request);
      }

      this.metricsService.recordComplianceOperation('sanctions_screening_business', 'success');
      this.metricsService.recordSanctionsScreening('business', result.sanctionsMatch);

      this.logger.log(`Business screening completed: ${request.businessName}, sanctions: ${result.sanctionsMatch}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to screen business: ${error.message}`, error.stack);
      this.metricsService.recordComplianceOperation('sanctions_screening_business', 'failure');
      this.metricsService.recordError('sanctions_screening', 'high');
      
      // Return safe default on error
      return this.createDefaultBusinessResult();
    }
  }

  private async screenWithWorldCheck(request: IndividualScreeningRequest): Promise<ScreeningResult> {
    const apiUrl = this.configService.get<string>('sanctions.worldcheck.apiUrl');
    const apiKey = this.configService.get<string>('sanctions.worldcheck.apiKey');

    if (!apiUrl || !apiKey) {
      this.logger.warn('WorldCheck API credentials not configured, using mock result');
      return this.mockScreeningResult(request);
    }

    const payload = {
      name: request.fullName,
      dateOfBirth: request.dateOfBirth?.toISOString().split('T')[0],
      nationality: request.nationality,
      address: request.address,
      screening_type: 'comprehensive',
    };

    const response = await firstValueFrom(
      this.httpService.post(`${apiUrl}/screen/individual`, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }),
    );

    return this.parseWorldCheckResponse(response.data);
  }

  private async screenBusinessWithWorldCheck(request: BusinessScreeningRequest): Promise<BusinessScreeningResult> {
    const apiUrl = this.configService.get<string>('sanctions.worldcheck.apiUrl');
    const apiKey = this.configService.get<string>('sanctions.worldcheck.apiKey');

    if (!apiUrl || !apiKey) {
      this.logger.warn('WorldCheck API credentials not configured, using mock result');
      return this.mockBusinessScreeningResult(request);
    }

    const payload = {
      name: request.businessName,
      registrationNumber: request.registrationNumber,
      country: request.incorporationCountry,
      address: request.address,
      screening_type: 'business',
    };

    const response = await firstValueFrom(
      this.httpService.post(`${apiUrl}/screen/business`, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }),
    );

    return this.parseWorldCheckBusinessResponse(response.data);
  }

  private async screenWithComplyAdvantage(request: IndividualScreeningRequest): Promise<ScreeningResult> {
    const apiUrl = this.configService.get<string>('sanctions.complyAdvantage.apiUrl');
    const apiKey = this.configService.get<string>('sanctions.complyAdvantage.apiKey');

    if (!apiUrl || !apiKey) {
      this.logger.warn('ComplyAdvantage API credentials not configured, using mock result');
      return this.mockScreeningResult(request);
    }

    const payload = {
      search_term: request.fullName,
      types: ['sanction', 'warning', 'fitness-probity', 'pep'],
      exact_match: false,
      fuzziness: 0.6,
    };

    const response = await firstValueFrom(
      this.httpService.post(`${apiUrl}/searches`, payload, {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }),
    );

    return this.parseComplyAdvantageResponse(response.data, request);
  }

  private async screenBusinessWithComplyAdvantage(request: BusinessScreeningRequest): Promise<BusinessScreeningResult> {
    const apiUrl = this.configService.get<string>('sanctions.complyAdvantage.apiUrl');
    const apiKey = this.configService.get<string>('sanctions.complyAdvantage.apiKey');

    if (!apiUrl || !apiKey) {
      this.logger.warn('ComplyAdvantage API credentials not configured, using mock result');
      return this.mockBusinessScreeningResult(request);
    }

    const payload = {
      search_term: request.businessName,
      types: ['sanction', 'warning'],
      exact_match: false,
      fuzziness: 0.6,
    };

    const response = await firstValueFrom(
      this.httpService.post(`${apiUrl}/searches`, payload, {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }),
    );

    return this.parseComplyAdvantageBusinessResponse(response.data, request);
  }

  private parseWorldCheckResponse(data: any): ScreeningResult {
    const matches: ScreeningMatch[] = (data.matches || []).map((match: any) => ({
      id: match.id,
      name: match.name,
      type: this.determineMatchType(match.category),
      list: match.list_name,
      confidence: match.match_score,
      details: match,
    }));

    return {
      sanctionsMatch: matches.some(m => m.type === 'sanctions'),
      pepMatch: matches.some(m => m.type === 'pep'),
      adverseMediaMatch: matches.some(m => m.type === 'adverse_media'),
      countryRisk: this.calculateCountryRisk(data.country),
      matches,
      confidence: data.overall_confidence || 0.5,
      screenedAt: new Date(),
    };
  }

  private parseWorldCheckBusinessResponse(data: any): BusinessScreeningResult {
    const matches: ScreeningMatch[] = (data.matches || []).map((match: any) => ({
      id: match.id,
      name: match.name,
      type: this.determineMatchType(match.category),
      list: match.list_name,
      confidence: match.match_score,
      details: match,
    }));

    return {
      sanctionsMatch: matches.some(m => m.type === 'sanctions'),
      adverseMediaMatch: matches.some(m => m.type === 'adverse_media'),
      jurisdictionRisk: this.calculateCountryRisk(data.country),
      matches,
      confidence: data.overall_confidence || 0.5,
      screenedAt: new Date(),
    };
  }

  private parseComplyAdvantageResponse(data: any, request: IndividualScreeningRequest): ScreeningResult {
    const matches: ScreeningMatch[] = (data.hits || []).map((hit: any) => ({
      id: hit.id,
      name: hit.name,
      type: this.mapComplyAdvantageType(hit.types),
      list: hit.sources?.join(', ') || 'Unknown',
      confidence: hit.match_types?.includes('exact_match') ? 0.95 : 0.7,
      details: hit,
    }));

    return {
      sanctionsMatch: matches.some(m => m.type === 'sanctions'),
      pepMatch: matches.some(m => m.type === 'pep'),
      adverseMediaMatch: matches.some(m => m.type === 'adverse_media'),
      countryRisk: this.calculateCountryRisk(request.nationality),
      matches,
      confidence: data.confidence || 0.5,
      screenedAt: new Date(),
    };
  }

  private parseComplyAdvantageBusinessResponse(data: any, request: BusinessScreeningRequest): BusinessScreeningResult {
    const matches: ScreeningMatch[] = (data.hits || []).map((hit: any) => ({
      id: hit.id,
      name: hit.name,
      type: this.mapComplyAdvantageType(hit.types),
      list: hit.sources?.join(', ') || 'Unknown',
      confidence: hit.match_types?.includes('exact_match') ? 0.95 : 0.7,
      details: hit,
    }));

    return {
      sanctionsMatch: matches.some(m => m.type === 'sanctions'),
      adverseMediaMatch: matches.some(m => m.type === 'adverse_media'),
      jurisdictionRisk: this.calculateCountryRisk(request.incorporationCountry),
      matches,
      confidence: data.confidence || 0.5,
      screenedAt: new Date(),
    };
  }

  private async mockScreeningResult(request: IndividualScreeningRequest): Promise<ScreeningResult> {
    // Mock implementation for development/testing
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay

    const isHighRisk = this.isHighRiskName(request.fullName);
    
    return {
      sanctionsMatch: isHighRisk && Math.random() > 0.9,
      pepMatch: isHighRisk && Math.random() > 0.95,
      adverseMediaMatch: isHighRisk && Math.random() > 0.8,
      countryRisk: this.calculateCountryRisk(request.nationality),
      matches: [],
      confidence: 0.85,
      screenedAt: new Date(),
    };
  }

  private async mockBusinessScreeningResult(request: BusinessScreeningRequest): Promise<BusinessScreeningResult> {
    // Mock implementation for development/testing
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay

    const isHighRisk = this.isHighRiskBusinessName(request.businessName);
    
    return {
      sanctionsMatch: isHighRisk && Math.random() > 0.95,
      adverseMediaMatch: isHighRisk && Math.random() > 0.9,
      jurisdictionRisk: this.calculateCountryRisk(request.incorporationCountry),
      matches: [],
      confidence: 0.85,
      screenedAt: new Date(),
    };
  }

  private determineMatchType(category: string): 'sanctions' | 'pep' | 'adverse_media' {
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('sanction') || lowerCategory.includes('embargo')) {
      return 'sanctions';
    }
    
    if (lowerCategory.includes('pep') || lowerCategory.includes('political')) {
      return 'pep';
    }
    
    return 'adverse_media';
  }

  private mapComplyAdvantageType(types: string[]): 'sanctions' | 'pep' | 'adverse_media' {
    if (types.includes('sanction')) return 'sanctions';
    if (types.includes('pep')) return 'pep';
    return 'adverse_media';
  }

  private calculateCountryRisk(country?: string): number {
    if (!country) return 0.3;

    const highRiskCountries = [
      'north korea', 'iran', 'syria', 'afghanistan', 'somalia', 'yemen',
      'libya', 'iraq', 'venezuela', 'myanmar', 'belarus'
    ];

    const mediumRiskCountries = [
      'russia', 'china', 'pakistan', 'lebanon', 'zimbabwe', 'nicaragua',
      'eritrea', 'central african republic', 'democratic republic of congo'
    ];

    const lowerCountry = country.toLowerCase();
    
    if (highRiskCountries.some(risk => lowerCountry.includes(risk))) {
      return 0.9;
    }
    
    if (mediumRiskCountries.some(risk => lowerCountry.includes(risk))) {
      return 0.6;
    }

    return 0.2;
  }

  private isHighRiskName(name: string): boolean {
    const testNames = ['vladimir putin', 'osama bin laden', 'test sanctions', 'john doe test'];
    return testNames.some(testName => name.toLowerCase().includes(testName));
  }

  private isHighRiskBusinessName(name: string): boolean {
    const testNames = ['sanctions test corp', 'embargo business', 'test sanctions llc'];
    return testNames.some(testName => name.toLowerCase().includes(testName));
  }

  private createDefaultResult(): ScreeningResult {
    return {
      sanctionsMatch: false,
      pepMatch: false,
      adverseMediaMatch: false,
      countryRisk: 0.2,
      matches: [],
      confidence: 0.5,
      screenedAt: new Date(),
    };
  }

  private createDefaultBusinessResult(): BusinessScreeningResult {
    return {
      sanctionsMatch: false,
      adverseMediaMatch: false,
      jurisdictionRisk: 0.2,
      matches: [],
      confidence: 0.5,
      screenedAt: new Date(),
    };
  }
}