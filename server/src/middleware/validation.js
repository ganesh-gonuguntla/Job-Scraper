import { z } from 'zod';

/**
 * Validation schemas for all API endpoints
 */

// Auth schemas
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Profile schemas
export const skillsSchema = z.object({
  skills: z.array(z.string().min(1)).min(1, 'At least one skill is required'),
  experience: z.string().max(5000, 'Experience text too long').optional(),
  location: z.string().max(100, 'Location text too long').optional(),
  target_roles: z.array(z.string().min(1)).optional(),
});

// Settings schemas
export const settingsSchema = z.object({
  auto_apply: z.boolean().optional(),
  review_before_send: z.boolean().optional(),
  follow_up_days: z.number().min(0).max(365).optional(),
  match_threshold: z.number().min(0).max(100).optional(),
  smtp_pass: z.string().optional(), // Will be deprecated
});

// Match schemas
export const matchSchema = z.object({
  job_id: z.string().regex(/^[0-9a-f]{24}$/, 'Invalid job ID'),
});

// Application schemas
export const applicationSchema = z.object({
  match_id: z.string().regex(/^[0-9a-f]{24}$/, 'Invalid match ID'),
});

// Job schemas
export const jobQuerySchema = z.object({
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional(),
  skip: z.string().transform(Number).refine(n => n >= 0, 'Skip must be non-negative').optional(),
});

/**
 * Middleware factory to validate request body
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware factory to validate query parameters
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}
