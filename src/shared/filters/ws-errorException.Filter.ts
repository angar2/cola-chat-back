import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Catch(Error)
export class WsErrorExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger();

  catch(exception: Error, host: ArgumentsHost) {
    const context = host.switchToWs();
    const client = context.getClient();

    const message =
      exception instanceof WsException ? exception.message : HttpStatus[500];

    if (process.env.NODE_ENV === 'dev')
      this.logger.error(`Failed to execute {${client.url}, ${exception}`);

    client.send(
      JSON.stringify({
        success: false,
        message,
        data: null,
      }),
    );
  }
}
