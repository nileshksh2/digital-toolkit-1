import { FormConfiguration, FormField, FormSubmission, FormFieldType, ValidationRule, ConditionalLogic, EntityType } from '../../shared/types';
import { DatabaseConnection } from '../../shared/types';
import { NotFoundError, ValidationError } from '../../shared/types';

export class FormBuilderService {
  constructor(private db: DatabaseConnection) {}

  async createForm(formData: {
    name: string;
    description?: string;
    entity_type: EntityType;
    fields: FormField[];
    created_by: number;
  }): Promise<FormConfiguration> {
    const { name, description, entity_type, fields, created_by } = formData;

    // Validate form fields
    this.validateFormFields(fields);

    const query = `
      INSERT INTO forms (
        name, description, entity_type, configuration, is_active, 
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, true, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const configuration = {
      fields,
      validation_rules: this.extractValidationRules(fields),
      conditional_logic: this.extractConditionalLogic(fields)
    };

    const result = await this.db.query(query, [
      name,
      description,
      entity_type,
      JSON.stringify(configuration),
      created_by
    ]);

    return await this.getFormById(result.insertId);
  }

  async getFormById(id: number): Promise<FormConfiguration> {
    const query = `
      SELECT 
        f.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM forms f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ? AND f.is_active = true
    `;

    const form = await this.db.queryFirst(query, [id]);

    if (!form) {
      throw new NotFoundError('Form', id);
    }

    const configuration = JSON.parse(form.configuration);

    return {
      id: form.id,
      name: form.name,
      description: form.description,
      entity_type: form.entity_type,
      fields: configuration.fields || [],
      is_active: form.is_active,
      created_by: form.created_by
    };
  }

  async updateForm(id: number, updates: {
    name?: string;
    description?: string;
    fields?: FormField[];
    updated_by: number;
  }): Promise<FormConfiguration> {
    const existingForm = await this.getFormById(id);
    const { name, description, fields, updated_by } = updates;

    if (fields) {
      this.validateFormFields(fields);
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (fields) {
      const configuration = {
        fields,
        validation_rules: this.extractValidationRules(fields),
        conditional_logic: this.extractConditionalLogic(fields)
      };

      updateFields.push('configuration = ?');
      updateValues.push(JSON.stringify(configuration));
    }

    if (updateFields.length === 0) {
      return existingForm;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `UPDATE forms SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    return await this.getFormById(id);
  }

  async deleteForm(id: number): Promise<void> {
    const form = await this.getFormById(id);

    // Check if form has submissions
    const submissionCount = await this.db.queryFirst(
      'SELECT COUNT(*) as count FROM form_submissions WHERE form_id = ?',
      [id]
    );

    if (submissionCount.count > 0) {
      throw new ValidationError(`Cannot delete form '${form.name}' as it has ${submissionCount.count} submission(s)`);
    }

    // Soft delete
    await this.db.query(
      'UPDATE forms SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  async getAllForms(filters?: {
    entity_type?: EntityType;
    created_by?: number;
    search?: string;
  }): Promise<FormConfiguration[]> {
    let query = `
      SELECT 
        f.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.id) as submission_count
      FROM forms f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.is_active = true
    `;

    const queryParams = [];

    if (filters?.entity_type) {
      query += ' AND f.entity_type = ?';
      queryParams.push(filters.entity_type);
    }

    if (filters?.created_by) {
      query += ' AND f.created_by = ?';
      queryParams.push(filters.created_by);
    }

    if (filters?.search) {
      query += ' AND (f.name LIKE ? OR f.description LIKE ?)';
      queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY f.created_at DESC';

    const forms = await this.db.query(query, queryParams);

    return forms.map(form => {
      const configuration = JSON.parse(form.configuration);
      return {
        id: form.id,
        name: form.name,
        description: form.description,
        entity_type: form.entity_type,
        fields: configuration.fields || [],
        is_active: form.is_active,
        created_by: form.created_by,
        submission_count: form.submission_count
      };
    });
  }

  async duplicateForm(id: number, newName: string, duplicatedBy: number): Promise<FormConfiguration> {
    const originalForm = await this.getFormById(id);

    return await this.createForm({
      name: newName,
      description: `Copy of ${originalForm.description || originalForm.name}`,
      entity_type: originalForm.entity_type,
      fields: originalForm.fields,
      created_by: duplicatedBy
    });
  }

  // Form Submissions
  async submitForm(submissionData: {
    form_id: number;
    entity_type: EntityType;
    entity_id: number;
    submission_data: Record<string, any>;
    submitted_by: number;
  }): Promise<FormSubmission> {
    const { form_id, entity_type, entity_id, submission_data, submitted_by } = submissionData;

    // Get form configuration
    const form = await this.getFormById(form_id);

    // Validate submission data
    const validationResult = this.validateSubmissionData(form.fields, submission_data);
    if (!validationResult.isValid) {
      throw new ValidationError('Form validation failed', validationResult.errors);
    }

    // Process conditional fields
    const processedData = this.processConditionalFields(form.fields, submission_data);

    const query = `
      INSERT INTO form_submissions (
        form_id, entity_type, entity_id, submission_data, submitted_by, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      form_id,
      entity_type,
      entity_id,
      JSON.stringify(processedData),
      submitted_by
    ]);

    return await this.getSubmissionById(result.insertId);
  }

  async getSubmissionById(id: number): Promise<FormSubmission> {
    const query = `
      SELECT 
        fs.*,
        f.name as form_name,
        u.first_name as submitter_first_name,
        u.last_name as submitter_last_name
      FROM form_submissions fs
      JOIN forms f ON fs.form_id = f.id
      LEFT JOIN users u ON fs.submitted_by = u.id
      WHERE fs.id = ?
    `;

    const submission = await this.db.queryFirst(query, [id]);

    if (!submission) {
      throw new NotFoundError('Form submission', id);
    }

    return {
      ...submission,
      submission_data: JSON.parse(submission.submission_data)
    };
  }

  async getFormSubmissions(formId: number, filters?: {
    entity_id?: number;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    submissions: FormSubmission[];
    total: number;
  }> {
    let query = `
      SELECT 
        fs.*,
        f.name as form_name,
        u.first_name as submitter_first_name,
        u.last_name as submitter_last_name
      FROM form_submissions fs
      JOIN forms f ON fs.form_id = f.id
      LEFT JOIN users u ON fs.submitted_by = u.id
      WHERE fs.form_id = ?
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM form_submissions fs
      WHERE fs.form_id = ?
    `;

    const queryParams = [formId];
    const conditions = [];

    if (filters?.entity_id) {
      conditions.push('fs.entity_id = ?');
      queryParams.push(filters.entity_id);
    }

    if (filters?.start_date) {
      conditions.push('fs.created_at >= ?');
      queryParams.push(filters.start_date.toISOString());
    }

    if (filters?.end_date) {
      conditions.push('fs.created_at <= ?');
      queryParams.push(filters.end_date.toISOString());
    }

    if (conditions.length > 0) {
      const conditionString = ' AND ' + conditions.join(' AND ');
      query += conditionString;
      countQuery += conditionString;
    }

    // Get total count
    const countResult = await this.db.queryFirst(countQuery, queryParams);
    const total = countResult.total;

    // Add ordering and pagination
    query += ' ORDER BY fs.created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      queryParams.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      queryParams.push(filters.offset);
    }

    const submissions = await this.db.query(query, queryParams);

    const parsedSubmissions = submissions.map(submission => ({
      ...submission,
      submission_data: JSON.parse(submission.submission_data)
    }));

    return {
      submissions: parsedSubmissions,
      total
    };
  }

  async getEntitySubmissions(entityType: EntityType, entityId: number): Promise<FormSubmission[]> {
    const query = `
      SELECT 
        fs.*,
        f.name as form_name,
        u.first_name as submitter_first_name,
        u.last_name as submitter_last_name
      FROM form_submissions fs
      JOIN forms f ON fs.form_id = f.id
      LEFT JOIN users u ON fs.submitted_by = u.id
      WHERE fs.entity_type = ? AND fs.entity_id = ?
      ORDER BY fs.created_at DESC
    `;

    const submissions = await this.db.query(query, [entityType, entityId]);

    return submissions.map(submission => ({
      ...submission,
      submission_data: JSON.parse(submission.submission_data)
    }));
  }

  // Form Field Validation
  private validateFormFields(fields: FormField[]): void {
    const errors: string[] = [];
    const fieldNames = new Set<string>();

    for (const field of fields) {
      // Check for required properties
      if (!field.id || !field.name || !field.label || !field.type) {
        errors.push(`Field missing required properties: ${JSON.stringify(field)}`);
        continue;
      }

      // Check for duplicate field names
      if (fieldNames.has(field.name)) {
        errors.push(`Duplicate field name: ${field.name}`);
      }
      fieldNames.add(field.name);

      // Validate field type
      if (!Object.values(FormFieldType).includes(field.type)) {
        errors.push(`Invalid field type: ${field.type}`);
      }

      // Validate options for select fields
      if (['select', 'multiselect', 'radio'].includes(field.type)) {
        if (!field.options || field.options.length === 0) {
          errors.push(`Field '${field.name}' requires options`);
        }
      }

      // Validate validation rules
      if (field.validation_rules) {
        for (const rule of field.validation_rules) {
          if (!rule.type || !rule.message) {
            errors.push(`Invalid validation rule for field '${field.name}'`);
          }
        }
      }

      // Validate conditional logic
      if (field.conditional_logic) {
        this.validateConditionalLogic(field.conditional_logic, fieldNames, field.name, errors);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Form field validation failed', { validation_errors: errors });
    }
  }

  private validateConditionalLogic(logic: ConditionalLogic, fieldNames: Set<string>, currentFieldName: string, errors: string[]): void {
    const validateRules = (rules: any[], ruleType: string) => {
      for (const rule of rules) {
        if (!rule.field || !rule.operator || rule.value === undefined) {
          errors.push(`Invalid ${ruleType} rule for field '${currentFieldName}'`);
          continue;
        }

        if (!fieldNames.has(rule.field)) {
          errors.push(`${ruleType} rule references unknown field '${rule.field}' in field '${currentFieldName}'`);
        }

        if (rule.field === currentFieldName) {
          errors.push(`Field '${currentFieldName}' cannot reference itself in ${ruleType} rules`);
        }
      }
    };

    if (logic.show_if) {
      validateRules(logic.show_if, 'show_if');
    }

    if (logic.hide_if) {
      validateRules(logic.hide_if, 'hide_if');
    }
  }

  private validateSubmissionData(fields: FormField[], data: Record<string, any>): {
    isValid: boolean;
    errors: Record<string, string[]>;
  } {
    const errors: Record<string, string[]> = {};

    for (const field of fields) {
      const fieldErrors: string[] = [];
      const value = data[field.name];

      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        fieldErrors.push(`${field.label} is required`);
      }

      // Skip validation if field is empty and not required
      if (!field.required && (value === undefined || value === null || value === '')) {
        continue;
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
        for (const rule of field.validation_rules) {
          if (!this.validateRule(rule, value)) {
            fieldErrors.push(rule.message);
          }
        }
      }

      if (fieldErrors.length > 0) {
        errors[field.name] = fieldErrors;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  private validateRule(rule: ValidationRule, value: any): boolean {
    switch (rule.type) {
      case 'min':
        return typeof value === 'string' ? value.length >= (rule.min || 0) : Number(value) >= (rule.min || 0);
      case 'max':
        return typeof value === 'string' ? value.length <= (rule.max || Infinity) : Number(value) <= (rule.max || Infinity);
      case 'pattern':
        return rule.pattern ? rule.pattern.test(String(value)) : true;
      case 'custom':
        return rule.custom ? rule.custom(value) : true;
      default:
        return true;
    }
  }

  private processConditionalFields(fields: FormField[], data: Record<string, any>): Record<string, any> {
    const processedData = { ...data };

    for (const field of fields) {
      if (field.conditional_logic) {
        const shouldShow = this.evaluateConditionalLogic(field.conditional_logic, data);
        
        // Remove field data if it should be hidden
        if (!shouldShow && processedData[field.name] !== undefined) {
          delete processedData[field.name];
        }
      }
    }

    return processedData;
  }

  private evaluateConditionalLogic(logic: ConditionalLogic, data: Record<string, any>): boolean {
    let showField = true;

    // Evaluate show_if rules (AND logic)
    if (logic.show_if && logic.show_if.length > 0) {
      showField = logic.show_if.every(rule => this.evaluateConditionalRule(rule, data));
    }

    // Evaluate hide_if rules (OR logic)
    if (logic.hide_if && logic.hide_if.length > 0) {
      const shouldHide = logic.hide_if.some(rule => this.evaluateConditionalRule(rule, data));
      if (shouldHide) {
        showField = false;
      }
    }

    return showField;
  }

  private evaluateConditionalRule(rule: any, data: Record<string, any>): boolean {
    const fieldValue = data[rule.field];
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
  }

  private extractValidationRules(fields: FormField[]): Record<string, ValidationRule[]> {
    const rules: Record<string, ValidationRule[]> = {};
    
    for (const field of fields) {
      if (field.validation_rules && field.validation_rules.length > 0) {
        rules[field.name] = field.validation_rules;
      }
    }

    return rules;
  }

  private extractConditionalLogic(fields: FormField[]): Record<string, ConditionalLogic> {
    const logic: Record<string, ConditionalLogic> = {};
    
    for (const field of fields) {
      if (field.conditional_logic) {
        logic[field.name] = field.conditional_logic;
      }
    }

    return logic;
  }

  // Form Analytics
  async getFormAnalytics(formId: number): Promise<{
    total_submissions: number;
    submission_trend: Array<{ date: string; count: number }>;
    field_completion_rates: Record<string, number>;
    average_completion_time?: number;
  }> {
    const form = await this.getFormById(formId);

    // Total submissions
    const totalResult = await this.db.queryFirst(
      'SELECT COUNT(*) as total FROM form_submissions WHERE form_id = ?',
      [formId]
    );

    // Submission trend (last 30 days)
    const trendResult = await this.db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM form_submissions
      WHERE form_id = ? AND created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [formId]);

    // Field completion rates
    const submissions = await this.db.query(
      'SELECT submission_data FROM form_submissions WHERE form_id = ?',
      [formId]
    );

    const fieldCompletionRates: Record<string, number> = {};
    const totalSubmissions = submissions.length;

    if (totalSubmissions > 0) {
      for (const field of form.fields) {
        const completedCount = submissions.filter(sub => {
          const data = JSON.parse(sub.submission_data);
          return data[field.name] !== undefined && data[field.name] !== null && data[field.name] !== '';
        }).length;

        fieldCompletionRates[field.name] = Math.round((completedCount / totalSubmissions) * 100);
      }
    }

    return {
      total_submissions: totalResult.total,
      submission_trend: trendResult,
      field_completion_rates: fieldCompletionRates
    };
  }
}