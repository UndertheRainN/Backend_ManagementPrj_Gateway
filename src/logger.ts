import { utilities } from 'nest-winston';
import { join } from 'path';
import winston from 'winston';

const logger = winston.createLogger({
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
    new winston.transports.File({
      filename: join(process.cwd(), 'logs/app.json'),
    }),
  ],
});

export default logger;
