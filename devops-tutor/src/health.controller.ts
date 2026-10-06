import { Controller, Get } from '@nestjs/common';

/** Sondes liveness / readiness pour Kubernetes et Docker. */
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
