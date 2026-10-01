import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Organization } from '@prisma/client';

export const CurrentOrg = createParamDecorator(
  (data: keyof Organization | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const organization = request.organization as Organization;

    if (!organization) {
      return null;
    }

    return data ? organization[data] : organization;
  },
);
