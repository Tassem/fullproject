import winston from 'winston';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(LOGS_DIR, 'ai-generation-error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(LOGS_DIR, 'ai-generation-all.log'),
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export function logGenerationAttempt(data: {
  userId: string;
  mode: string;
  headline: string;
  promptLength?: number;
}) {
  logger.info('Generation Attempt', data);
}

export function logGenerationSuccess(data: {
  userId: string;
  method: string;
  attempts: number;
  creditsUsed: number;
  finalPrompt: string;
}) {
  logger.info('Generation Success', data);
}

export function logGenerationFailure(data: {
  userId: string;
  error: string;
  attempts: number;
  creditsRefunded: number;
}) {
  logger.error('Generation Failure', data);
}

export default logger;
