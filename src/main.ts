import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import cors from '@fastify/cors';
import {
  WINSTON_MODULE_NEST_PROVIDER,
  WinstonModule,
  utilities,
} from 'nest-winston';
import winston from 'winston';
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      bufferLogs: true,
      logger: WinstonModule.createLogger({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              utilities.format.nestLike('MONO', {
                colors: true,
                prettyPrint: true,
                processId: true,
                appName: true,
              }),
            ),
          }),
          new winston.transports.File({ filename: 'logs/app.json' }),
        ],
      }),
    },
  );
  app.register(cors);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  // app.register(helmet, {
  //   contentSecurityPolicy: {
  //     directives: {
  //       defaultSrc: [`'self'`, 'unpkg.com'],
  //       styleSrc: [
  //         `'self'`,
  //         `'unsafe-inline'`,
  //         'cdn.jsdelivr.net',
  //         'fonts.googleapis.com',
  //         'unpkg.com',
  //       ],
  //       fontSrc: [`'self'`, 'fonts.gstatic.com', 'data:'],
  //       imgSrc: [`'self'`, 'data:', 'cdn.jsdelivr.net'],
  //       scriptSrc: [
  //         `'self'`,
  //         `https: 'unsafe-inline'`,
  //         `cdn.jsdelivr.net`,
  //         `'unsafe-eval'`,
  //       ],
  //     },
  //   },
  // });
  const config = app.get(ConfigService);

  await app.listen(
    config.get<number>('PORT'),
    '0.0.0.0',
    (error: Error, address: string) => {
      if (error) {
        console.error(error.message);
      }
      console.log(`Start server with: ${address}`);
    },
  );
}
bootstrap();
