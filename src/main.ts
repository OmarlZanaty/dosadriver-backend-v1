import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter());

  // ✅ Cloud Run sets PORT=8080 (but keep a fallback)
  const port = Number(process.env.PORT) || 8080;

  // ✅ Must bind to 0.0.0.0 on Cloud Run
  await app.listen(port, '0.0.0.0');

  console.log(`Listening on ${port}`);
}

bootstrap();
