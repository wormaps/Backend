export type AppConfig = {
  appName: 'wormap-v2';
  environment: 'development' | 'test' | 'production';
};

export const defaultAppConfig: AppConfig = {
  appName: 'wormap-v2',
  environment: 'development',
};
