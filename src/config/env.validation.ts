import Joi from 'joi';
import { parseAndValidateExternalUrl } from '../common/http/external-url-validation.util';

const DEFAULT_OVERPASS_API_URLS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
].join(',');

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const schema = Joi.object({
    PORT: Joi.number().integer().min(1).max(65535).default(8080),
    GOOGLE_API_KEY: Joi.string().trim().required(),
    TOMTOM_API_KEY: Joi.string().trim().required(),
    MAPILLARY_ACCESS_TOKEN: Joi.string().trim().optional(),
    MAPILLARY_AUTHORIZATION_URL: Joi.string().trim().uri().optional(),
    OVERPASS_API_URLS: Joi.string().trim().default(DEFAULT_OVERPASS_API_URLS),
    SCENE_DATA_DIR: Joi.string().trim().default('data/scene'),
    CORS_ALLOWED_ORIGINS: Joi.string().trim().allow('').default(''),
    INTERNAL_API_KEY: Joi.string().trim().optional(),
  });

  const { value, error } = schema.validate(rawConfig, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`환경 변수 검증 실패: ${error.message}`);
  }

  const overpassUrls = String(value.OVERPASS_API_URLS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (overpassUrls.length === 0) {
    throw new Error(
      '환경 변수 검증 실패: OVERPASS_API_URLS 값이 비어 있습니다.',
    );
  }

  for (const url of overpassUrls) {
    const validated = parseAndValidateExternalUrl(url, {
      requireHttps: true,
      blockPrivateNetwork: true,
    });
    if (!validated) {
      throw new Error(
        `환경 변수 검증 실패: OVERPASS_API_URLS에 허용되지 않은 URL이 포함되어 있습니다 (${url})`,
      );
    }
  }

  return value;
}
