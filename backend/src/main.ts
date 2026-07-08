import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? '*', credentials: true });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not declared in the DTO
      forbidNonWhitelisted: true,
      transform: true, // apply @Type() coercions (e.g. pagination query numbers)
      errorHttpStatusCode: 422,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UCMS API')
    .setDescription(
      'Unified Church Management System — Foundation module (multi-tenancy, auth, RBAC/PBAC, configuration engine). ' +
        'Tenant-scoped routes require an `X-Tenant-Slug` header.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Tenant-Slug', in: 'header' }, 'tenant-slug')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`UCMS API listening on :${port} (prefix: /api/v1, docs: /api/docs)`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    'UCMS API failed to start. If this mentions Redis/ECONNREFUSED, the queue module needs Redis ' +
      'reachable at REDIS_URL — see README.md "Running the backend locally" for how to get one running.',
  );
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
