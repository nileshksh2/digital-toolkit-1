import React, { useState, useEffect } from 'react';
import { FormConfiguration, FormField, FormFieldType, ValidationRule, FormSubmission } from '../../shared/types';
import './FormRenderer.css';

interface FormRendererProps {
  form: FormConfiguration;
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  showSubmitButton?: boolean;
}

interface FormErrors {
  [fieldName: string]: string[];
}

export const FormRenderer: React.FC<FormRendererProps> = ({
  form,
  initialData = {},
  onSubmit,
  onCancel,
  readOnly = false,
  showSubmitButton = true
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Calculate initial field visibility
    updateFieldVisibility();
  }, [formData, form.fields]);

  const updateFieldVisibility = () => {
    const visible = new Set<string>();
    
    form.fields.forEach(field => {
      if (shouldShowField(field)) {
        visible.add(field.name);
      }
    });
    
    setVisibleFields(visible);
  };

  const shouldShowField = (field: FormField): boolean => {
    if (!field.conditional_logic) {
      return true;
    }

    const { show_if, hide_if } = field.conditional_logic;
    let shouldShow = true;

    // Evaluate show_if rules (AND logic)
    if (show_if && show_if.length > 0) {
      shouldShow = show_if.every(rule => evaluateConditionalRule(rule));
    }

    // Evaluate hide_if rules (OR logic)
    if (hide_if && hide_if.length > 0) {
      const shouldHide = hide_if.some(rule => evaluateConditionalRule(rule));
      if (shouldHide) {
        shouldShow = false;
      }
    }

    return shouldShow;
  };

  const evaluateConditionalRule = (rule: any): boolean => {
    const fieldValue = formData[rule.field];
    const ruleValue = rule.value;

    switch (rule.operator) {
      case 'equals':
        return fieldValue === ruleValue;
      case 'not_equals':
        return fieldValue !== ruleValue;
      case 'contains':
        return String(fieldValue).includes(String(ruleValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(ruleValue));
      case 'greater_than':
        return Number(fieldValue) > Number(ruleValue);
      case 'less_than':
        return Number(fieldValue) < Number(ruleValue);
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      case 'in':
        return Array.isArray(ruleValue) && ruleValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(ruleValue) && !ruleValue.includes(fieldValue);
      default:
        return false;
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    if (readOnly) return;

    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear field errors when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: []
      }));
    }
  };

  const validateField = (field: FormField, value: any): string[] => {
    const fieldErrors: string[] = [];

    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${field.label} is required`);
    }

    // Skip validation if field is empty and not required
    if (!field.required && (value === undefined || value === null || value === '')) {
      return fieldErrors;
    }

    // Type-specific validation
    switch (field.type) {
      case FormFieldType.EMAIL:
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          fieldErrors.push(`${field.label} must be a valid email address`);
        }
        break;

      case FormFieldType.NUMBER:
        if (value && isNaN(Number(value))) {
          fieldErrors.push(`${field.label} must be a valid number`);
        }
        break;

      case FormFieldType.DATE:
      case FormFieldType.DATETIME:
        if (value && isNaN(Date.parse(value))) {
          fieldErrors.push(`${field.label} must be a valid date`);
        }
        break;

      case FormFieldType.SELECT:
      case FormFieldType.RADIO:
        if (value && field.options && !field.options.some(opt => opt.value === value)) {
          fieldErrors.push(`${field.label} contains an invalid option`);
        }
        break;

      case FormFieldType.MULTISELECT:
        if (value && Array.isArray(value) && field.options) {
          const validValues = field.options.map(opt => opt.value);
          const invalidValues = value.filter(v => !validValues.includes(v));
          if (invalidValues.length > 0) {
            fieldErrors.push(`${field.label} contains invalid options: ${invalidValues.join(', ')}`);
          }
        }
        break;
    }

    // Custom validation rules
    if (field.validation_rules && value) {
      field.validation_rules.forEach(rule => {
        if (!validateRule(rule, value)) {
          fieldErrors.push(rule.message);
        }
      });
    }

    return fieldErrors;
  };

  const validateRule = (rule: ValidationRule, value: any): boolean => {
    switch (rule.type) {
      case 'min':
        return typeof value === 'string' 
          ? value.length >= (rule.min || 0) 
          : Number(value) >= (rule.min || 0);
      case 'max':
        return typeof value === 'string' 
          ? value.length <= (rule.max || Infinity) 
          : Number(value) <= (rule.max || Infinity);
      case 'pattern':
        return rule.pattern ? rule.pattern.test(String(value)) : true;
      case 'custom':
        return rule.custom ? rule.custom(value) : true;
      default:
        return true;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    form.fields.forEach(field => {
      if (visibleFields.has(field.name)) {
        const fieldErrors = validateField(field, formData[field.name]);
        if (fieldErrors.length > 0) {
          newErrors[field.name] = fieldErrors;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (readOnly) return;

    setSubmitting(true);

    try {
      if (validateForm()) {
        // Filter out data for hidden fields
        const visibleFormData: Record<string, any> = {};
        form.fields.forEach(field => {
          if (visibleFields.has(field.name) && formData[field.name] !== undefined) {
            visibleFormData[field.name] = formData[field.name];
          }
        });

        await onSubmit(visibleFormData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    if (!visibleFields.has(field.name)) {
      return null;
    }

    const value = formData[field.name] || '';
    const fieldErrors = errors[field.name] || [];
    const hasError = fieldErrors.length > 0;

    return (
      <div key={field.id} className={`form-field ${hasError ? 'has-error' : ''}`}>
        <label className={`field-label ${field.required ? 'required' : ''}`}>
          {field.label}
          {field.required && <span className="required-asterisk">*</span>}
        </label>

        {field.help_text && (
          <div className="help-text">{field.help_text}</div>
        )}

        <div className="field-input">
          {field.type === FormFieldType.TEXT && (
            <input
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={readOnly}
              className="form-control"
            />
          )}

          {field.type === FormFieldType.TEXTAREA && (
            <textarea
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={readOnly}
              className="form-control"
              rows={4}
            />
          )}

          {field.type === FormFieldType.EMAIL && (
            <input
              type="email"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={readOnly}
              className="form-control"
            />
          )}

          {field.type === FormFieldType.NUMBER && (
            <input
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={readOnly}
              className="form-control"
            />
          )}

          {field.type === FormFieldType.DATE && (
            <input
              type="date"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={readOnly}
              className="form-control"
            />
          )}

          {field.type === FormFieldType.DATETIME && (
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={readOnly}
              className="form-control"
            />
          )}

          {field.type === FormFieldType.SELECT && (
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              disabled={readOnly}
              className="form-control"
            >
              <option value="">Select an option...</option>
              {field.options?.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {field.type === FormFieldType.MULTISELECT && (
            <select
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e) => {
                const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                handleFieldChange(field.name, selectedValues);
              }}
              disabled={readOnly}
              className="form-control multiselect"
            >
              {field.options?.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {field.type === FormFieldType.RADIO && (
            <div className="radio-group">
              {field.options?.map((option, index) => (
                <label key={index} className="radio-option">
                  <input
                    type="radio"
                    name={field.name}
                    value={option.value}
                    checked={value === option.value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={readOnly}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )}

          {field.type === FormFieldType.CHECKBOX && (
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                disabled={readOnly}
              />
              <span>{field.placeholder || field.label}</span>
            </label>
          )}

          {field.type === FormFieldType.FILE && (
            <input
              type="file"
              onChange={(e) => handleFieldChange(field.name, e.target.files?.[0] || null)}
              disabled={readOnly}
              className="form-control"
              multiple={field.name.includes('multiple')}
            />
          )}
        </div>

        {hasError && (
          <div className="field-errors">
            {fieldErrors.map((error, index) => (
              <div key={index} className="error-message">
                {error}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="form-renderer">
      <form onSubmit={handleSubmit} className="dynamic-form">
        {form.description && (
          <div className="form-description">
            <p>{form.description}</p>
          </div>
        )}

        <div className="form-fields">
          {form.fields.map(renderField)}
        </div>

        {(showSubmitButton || onCancel) && (
          <div className="form-actions">
            {onCancel && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </button>
            )}
            {showSubmitButton && !readOnly && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default FormRenderer;