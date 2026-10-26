import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '@prisma/client';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessPayload {
  sub: string;
  role: Role;
}

const IS_PUBLIC = 'isPublic';
const ROLES = 'roles';
const REQUIRE_APPROVED = 'requireApproved';

/** Kimlik doğrulaması gerektirmeyen endpoint. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Yalnızca belirtilen roller. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/** Profili onaylanmış kullanıcı gerektirir (feed, beğeni, sohbet). */
export const RequireApproved = () => SetMetadata(REQUIRE_APPROVED, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  return ctx.switchToHttp().getRequest().user;
});

const BLOCKED_STATUSES = new Set(['BANNED', 'DELETED']);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException();

    const user = await this.userFromToken(token);
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException();

    if (this.reflector.getAllAndOverride<boolean>(REQUIRE_APPROVED, targets) && user.status !== 'APPROVED') {
      throw new ForbiddenException({ error: 'profile_not_approved' });
    }
    return true;
  }

  async userFromToken(token: string): Promise<User> {
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, { secret: env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || BLOCKED_STATUSES.has(user.status)) throw new UnauthorizedException({ error: 'account_blocked' });
    return user;
  }
}
