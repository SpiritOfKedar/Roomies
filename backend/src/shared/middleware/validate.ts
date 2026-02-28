/**
 * =============================================================================
 * Zod Validation Middleware
 * =============================================================================
 * Factory function that creates Express middleware for input validation.
 * Validates request body, query params, and route params against Zod schemas.
 *
 * Usage in routes:
 *   router.post('/register', validate({ body: registerSchema }), controller.register);
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { sendError } from '../utils/api-response';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Creates middleware that validates request parts against provided Zod schemas.
 * On validation failure, returns a 422 response with detailed error messages.
 * On success, replaces req.body/query/params with the parsed (sanitized) values.
 */
export function validate(schemas: ValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        // Express 5's req.query is a prototype getter that returns a new object
        // on every access, so Object.assign would mutate a throwaway object.
        // Use defineProperty to shadow the getter with an own data property.
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        Object.defineProperty(req, 'params', {
          value: parsedParams,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.issues
          .map((e) => `${(e.path as (string | number)[]).join('.')}: ${e.message}`)
          .join('; ');
        sendError(_res, `Validation failed: ${formatted}`, 422);
        return;
      }
      next(error);
    }
  };
}
