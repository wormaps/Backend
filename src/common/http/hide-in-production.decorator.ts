import { SetMetadata } from '@nestjs/common';

export const HIDE_IN_PRODUCTION = 'hideInProduction';

/**
 * Marks a route as hidden in production.
 * When NODE_ENV === 'production', the route returns 404 instead of executing.
 */
export const HideInProduction = () => SetMetadata(HIDE_IN_PRODUCTION, true);
