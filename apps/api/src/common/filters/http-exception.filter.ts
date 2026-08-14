import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : null;
    const message =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object' && 'message' in payload
          ? (payload as { message: string | string[] }).message
          : 'Internal server error';

    const text = Array.isArray(message) ? message.join(', ') : String(message);
    const expose = status < 500 || process.env.NODE_ENV !== 'production';

    response.status(status).json({
      data: null,
      error: {
        statusCode: status,
        message: expose ? text : 'Internal server error',
      },
    });
  }
}
