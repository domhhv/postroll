import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Logger } from 'nestjs-pino';
import { ZodError } from 'zod';

type PrismaKnownError = {
  code: string;
  meta?: Record<string, unknown>;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logger.error(this.toErrorMessage(exception), 'HTTP exception');
      response.status(status).json(exception.getResponse());
      return;
    }

    if (exception instanceof ZodError) {
      this.logger.error(this.toErrorMessage(exception), 'Validation error');
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        fieldErrors: this.formatZodIssues(exception),
      });
      return;
    }

    if (this.isPrismaKnownError(exception)) {
      switch (exception.code) {
        case 'P2002':
          response.status(HttpStatus.CONFLICT).json({
            statusCode: HttpStatus.CONFLICT,
            message: 'Resource already exists',
            target: exception.meta?.['target'],
          });
          return;
        case 'P2025':
          response.status(HttpStatus.NOT_FOUND).json({
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Resource not found',
          });
          return;
      }
    }

    this.logger.error(this.toErrorMessage(exception), 'Unhandled exception');
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }

  private toErrorMessage(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.stack || exception.message;
    }
    return String(exception);
  }

  private formatZodIssues(error: ZodError): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return fieldErrors;
  }

  private isPrismaKnownError(error: unknown): error is PrismaKnownError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string' &&
      (error as { code: string }).code.startsWith('P')
    );
  }
}
