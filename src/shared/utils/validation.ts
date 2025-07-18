import { ValidationRule, ValidationResult } from '../types';

export function validateField(value: any, rules: ValidationRule[]): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    try {
      switch (rule.type) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            errors.push(rule.message || 'This field is required');
          }
          break;

        case 'string':
          if (typeof value !== 'string') {
            errors.push(rule.message || 'This field must be a string');
          }
          break;

        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(rule.message || 'This field must be a number');
          }
          break;

        case 'email':
          if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(rule.message || 'This field must be a valid email address');
          }
          break;

        case 'date':
          if (value && isNaN(Date.parse(value))) {
            errors.push(rule.message || 'This field must be a valid date');
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(rule.message || 'This field must be a boolean');
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            errors.push(rule.message || 'This field must be an array');
          }
          break;

        case 'object':
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            errors.push(rule.message || 'This field must be an object');
          }
          break;
      }

      // Check min/max constraints
      if (rule.min !== undefined) {
        if (typeof value === 'string' && value.length < rule.min) {
          errors.push(rule.message || `This field must be at least ${rule.min} characters`);
        } else if (typeof value === 'number' && value < rule.min) {
          errors.push(rule.message || `This field must be at least ${rule.min}`);
        }
      }

      if (rule.max !== undefined) {
        if (typeof value === 'string' && value.length > rule.max) {
          errors.push(rule.message || `This field must be at most ${rule.max} characters`);
        } else if (typeof value === 'number' && value > rule.max) {
          errors.push(rule.message || `This field must be at most ${rule.max}`);
        }
      }

      // Check pattern
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(rule.message || 'This field format is invalid');
      }

      // Check custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          errors.push(typeof customResult === 'string' ? customResult : (rule.message || 'This field is invalid'));
        }
      }
    } catch (error) {
      errors.push('Validation error occurred');
    }
  }

  return errors;
}

export function validateSchema(data: any, schema: Record<string, ValidationRule[]>): ValidationResult {
  const errors: Record<string, string[]> = {};
  let hasErrors = false;

  for (const [fieldName, rules] of Object.entries(schema)) {
    const fieldErrors = validateField(data[fieldName], rules);
    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors;
      hasErrors = true;
    }
  }

  return {
    isValid: !hasErrors,
    errors
  };
}

export function createValidationRule(
  type: ValidationRule['type'],
  options: Partial<ValidationRule> = {}
): ValidationRule {
  return {
    type,
    ...options
  };
}

// Common validation rules
export const commonRules = {
  required: (): ValidationRule => ({ type: 'required' }),
  string: (min?: number, max?: number): ValidationRule => ({ type: 'string', min, max }),
  number: (min?: number, max?: number): ValidationRule => ({ type: 'number', min, max }),
  email: (): ValidationRule => ({ type: 'email' }),
  date: (): ValidationRule => ({ type: 'date' }),
  boolean: (): ValidationRule => ({ type: 'boolean' }),
  array: (): ValidationRule => ({ type: 'array' }),
  object: (): ValidationRule => ({ type: 'object' })
};

// Request validation function
export function validateRequest(data: any, schema: Record<string, ValidationRule[]>): ValidationResult {
  return validateSchema(data, schema);
}