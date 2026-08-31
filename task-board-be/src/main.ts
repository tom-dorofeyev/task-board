import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configuredPort } from './server-configuration.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(configuredPort(process.env.PORT));
}
await bootstrap();
