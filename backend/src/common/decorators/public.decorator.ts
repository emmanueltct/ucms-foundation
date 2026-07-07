import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'ucms:isPublic';

/** Marks a route as not requiring an access token (e.g. login, register, refresh). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
