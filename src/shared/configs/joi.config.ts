import * as Joi from 'joi';

export const joiConfigSchema = Joi.object({
  // Host
  PORT: Joi.number().port().required(),

  // Database
  DB_URL: Joi.string()
    .uri()
    .regex(/^mysql:\/\/.*$/)
    .required(),

  // Cors Origin
  HTTP_CORS_ORIGIN: Joi.string().uri().required(),
  WS_CORS_ORIGIN: Joi.string()
    .uri()
    .regex(/^ws:\/\//)
    .required(),
});
