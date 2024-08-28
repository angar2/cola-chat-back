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
export class WsResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((response) => {
        return {
          success: true,
          message: response?.message || COMMENTS.RESPONSE.DEFAULT,
          data: response?.data || null,
        };
      }),
    );
  }
}
