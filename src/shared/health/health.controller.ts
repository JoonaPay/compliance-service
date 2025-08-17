import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { MetricsService } from '../metrics/metrics.service';
import { KafkaService } from '../kafka/kafka.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly kafkaService: KafkaService,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const result = await this.health.check([
      // Database Health Check
      () => this.db.pingCheck('database'),

      // Memory Health Check (ensure heap doesn't exceed 300MB)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // Memory Health Check (ensure RSS doesn't exceed 300MB)  
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),

      // Disk Health Check (ensure disk usage doesn't exceed 75%)
      () => this.disk.checkStorage('storage', {
        path: '/',
        thresholdPercent: 0.75,
      }),

      // Kafka Health Check
      () => this.checkKafkaHealth(),

      // Custom Application Health Checks
      () => this.checkApplicationHealth(),
    ]);

    // Record health check metrics
    const status = result.status === 'ok' ? 'healthy' : 'unhealthy';
    this.metricsService.recordHealthCheck('overall', status);

    return result;
  }

  @Get('ready')
  @HealthCheck()
  async ready() {
    const result = await this.health.check([
      // Only check critical services for readiness
      () => this.db.pingCheck('database'),
      () => this.checkKafkaHealth(),
    ]);

    const status = result.status === 'ok' ? 'healthy' : 'unhealthy';
    this.metricsService.recordHealthCheck('readiness', status);

    return result;
  }

  @Get('live')
  @HealthCheck()
  async live() {
    const result = await this.health.check([
      // Basic liveness check - just verify the application is responsive
      () => this.checkApplicationHealth(),
    ]);

    const status = result.status === 'ok' ? 'healthy' : 'unhealthy';  
    this.metricsService.recordHealthCheck('liveness', status);

    return result;
  }

  private async checkKafkaHealth(): Promise<any> {
    try {
      // Simple check to verify Kafka service is initialized
      // In a real implementation, you might ping Kafka brokers
      const isKafkaHealthy = this.kafkaService !== undefined;
      
      return {
        kafka: {
          status: isKafkaHealthy ? 'up' : 'down',
          message: isKafkaHealthy ? 'Kafka service is running' : 'Kafka service is not available',
        },
      };
    } catch (error) {
      this.logger.error('Kafka health check failed:', error);
      throw new Error(`Kafka health check failed: ${error.message}`);
    }
  }

  private async checkApplicationHealth(): Promise<any> {
    try {
      // Check if metrics service is working
      const metricsHealthy = this.metricsService !== undefined;
      
      // Check configuration
      const dbHost = this.configService.get<string>('database.host');
      const configHealthy = !!dbHost;

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryHealthy = memoryUsage.heapUsed < 250 * 1024 * 1024; // 250MB threshold

      // Check uptime
      const uptime = process.uptime();
      const uptimeHealthy = uptime > 0;

      const allHealthy = metricsHealthy && configHealthy && memoryHealthy && uptimeHealthy;

      return {
        application: {
          status: allHealthy ? 'up' : 'down',
          details: {
            metrics: metricsHealthy ? 'up' : 'down',
            configuration: configHealthy ? 'up' : 'down',
            memory: {
              status: memoryHealthy ? 'up' : 'down',
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              external: Math.round(memoryUsage.external / 1024 / 1024),
              unit: 'MB',
            },
            uptime: {
              status: uptimeHealthy ? 'up' : 'down',
              seconds: Math.round(uptime),
              formatted: this.formatUptime(uptime),
            },
          },
        },
      };
    } catch (error) {
      this.logger.error('Application health check failed:', error);
      throw new Error(`Application health check failed: ${error.message}`);
    }
  }

  private formatUptime(uptimeSeconds: number): string {
    const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
    const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}