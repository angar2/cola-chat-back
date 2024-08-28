import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { COMMENTS } from '../constants/comment';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpResponse = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((response) => {
        httpResponse.status(response?.statusCode || 200);
        return {
          success: true,
          message: response?.message || COMMENTS.RESPONSE.DEFAULT,
          data: response?.data || null,
        };
      }),
    );
  }
}
