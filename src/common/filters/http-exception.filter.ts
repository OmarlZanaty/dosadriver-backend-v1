import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException ? exception.getResponse() : null;

    // Normalize message/code
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';

    if (typeof raw === 'string') {
      code = raw;
      message = raw;
    } else if (raw && typeof raw === 'object') {
      // Nest often returns: { statusCode, message, error }
      const r: any = raw;
      if (typeof r.code === 'string') code = r.code;
      if (typeof r.message === 'string') message = r.message;
      if (Array.isArray(r.message)) message = r.message.join(', ');
      if (!r.code && typeof r.error === 'string') code = r.error;
    } else if (exception?.message) {
      code = exception.message;
      message = exception.message;
    }

    // Map common internal strings to stable API codes
    const map: Record<string, { code: string; message: string }> = {
      RIDE_ALREADY_TAKEN: {
        code: 'RIDE_ALREADY_TAKEN',
        message: 'Ride was accepted by another captain.',
      },
      NOT_YOUR_RIDE: {
        code: 'NOT_YOUR_RIDE',
        message: 'You are not the owner of this ride.',
      },
      TERMINAL_RIDE: {
        code: 'TERMINAL_RIDE',
        message: 'Ride is completed or canceled.',
      },
    };

    if (map[code]) {
      message = map[code].message;
      code = map[code].code;
    }

    res.status(status).json({
      statusCode: status,
      code,
      message,
      path: req?.url,
      timestamp: new Date().toISOString(),
    });
  }
}
