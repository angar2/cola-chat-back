import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { COMMENTS } from '../constants/comment';

@Catch(Error)
export class ErrorExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger();

  catch(exception: Error, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.message : HttpStatus[500];

    if (process.env.NODE_ENV === 'dev')
      this.logger.error(
        `Failed to execute API {${request.url}, ${request.method}} route, HTTP ${statusCode} ${exception}`,
      );

    response.status(statusCode).json({
      success: false,
      message,
      data: null,
    });
  }
}
