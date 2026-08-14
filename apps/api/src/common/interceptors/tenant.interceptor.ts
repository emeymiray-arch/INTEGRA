import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthUser } from '../types/auth-user.interface';
import { runWithTenant } from '../tenant/tenant-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const organizationId = request.user?.organizationId;
    if (!organizationId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      runWithTenant(organizationId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
