import { Request, Response } from 'express';
import { FormBuilderService } from '../../modules/forms/form-builder-service';
import { ApiResponse, FormConfiguration, FormSubmission, EntityType } from '../../shared/types';
import { ValidationError, NotFoundError, ApplicationError } from '../../shared/types';

export class FormController {
  constructor(private formBuilderService: FormBuilderService) {}

  async createForm(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, entity_type, fields } = req.body;
      const created_by = req.user?.id; // From auth middleware

      if (!name || !entity_type || !fields || !Array.isArray(fields)) {
        const response: ApiResponse = {
          success: false,
          message: 'Missing required fields',
          errors: ['name, entity_type, and fields array are required']
        };
        res.status(400).json(response);
        return;
      }

      if (fields.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'At least one field is required',
          errors: ['Fields array cannot be empty']
        };
        res.status(400).json(response);
        return;
      }

      const form = await this.formBuilderService.createForm({
        name,
        description,
        entity_type: entity_type as EntityType,
        fields,
        created_by
      });

      const response: ApiResponse = {
        success: true,
        data: form,
        message: 'Form created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getForm(req: Request, res: Response): Promise<void> {
    try {
      const formId = parseInt(req.params.id);

      if (!formId || isNaN(formId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid form ID',
          errors: ['Form ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const form = await this.formBuilderService.getFormById(formId);

      const response: ApiResponse = {
        success: true,
        data: form
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateForm(req: Request, res: Response): Promise<void> {
    try {
      const formId = parseInt(req.params.id);
      const { name, description, fields } = req.body;
      const updated_by = req.user?.id;

      if (!formId || isNaN(formId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid form ID',
          errors: ['Form ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const updates: any = { updated_by };

      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (fields !== undefined) {
        if (!Array.isArray(fields)) {
          const response: ApiResponse = {
            success: false,
            message: 'Invalid fields data',
            errors: ['Fields must be an array']
          };
          res.status(400).json(response);
          return;
        }
        updates.fields = fields;
      }

      const form = await this.formBuilderService.updateForm(formId, updates);

      const response: ApiResponse = {
        success: true,
        data: form,
        message: 'Form updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async deleteForm(req: Request, res: Response): Promise<void> {
    try {
      const formId = parseInt(req.params.id);

      if (!formId || isNaN(formId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid form ID',
          errors: ['Form ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      await this.formBuilderService.deleteForm(formId);

      const response: ApiResponse = {
        success: true,
        message: 'Form deleted successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getAllForms(req: Request, res: Response): Promise<void> {
    try {
      const { entity_type, created_by, search } = req.query;

      const filters: any = {};

      if (entity_type) {
        filters.entity_type = entity_type as EntityType;
      }

      if (created_by) {
        const createdById = parseInt(created_by as string);
        if (!isNaN(createdById)) {
          filters.created_by = createdById;
        }
      }

      if (search) {
        filters.search = search as string;
      }

      const forms = await this.formBuilderService.getAllForms(filters);

      const response: ApiResponse = {
        success: true,
        data: forms
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async duplicateForm(req: Request, res: Response): Promise<void> {
    try {
      const formId = parseInt(req.params.id);
      const { new_name } = req.body;
      const duplicated_by = req.user?.id;

      if (!formId || isNaN(formId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid form ID',
          errors: ['Form ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!new_name || typeof new_name !== 'string') {
        const response: ApiResponse = {
          success: false,
          message: 'New form name is required',
          errors: ['new_name must be provided as a string']
        };
        res.status(400).json(response);
        return;
      }

      const duplicatedForm = await this.formBuilderService.duplicateForm(
        formId,
        new_name,
        duplicated_by
      );

      const response: ApiResponse = {
        success: true,
        data: duplicatedForm,
        message: 'Form duplicated successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async submitForm(req: Request, res: Response): Promise<void> {
    try {
      const formId = parseInt(req.params.id);
      const { entity_type, entity_id, submission_data } = req.body;
      const submitted_by = req.user?.id;

      if (!formId || isNaN(formId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid form ID',
          errors: ['Form ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!entity_type || !entity_id || !submission_data) {
        const response: ApiResponse = {
          success: false,
          message: 'Missing required fields',
          errors: ['entity_type, entity_id, and submission_data are required']
        };
        res.status(400).json(response);
        return;
      }

      const submission = await this.formBuilderService.submitForm({
        form_id: formId,
        entity_type: entity_type as EntityType,
        entity_id: parseInt(entity_id),
        submission_data,
        submitted_by
      });

      const response: ApiResponse = {
        success: true,
        data: submission,
        message: 'Form submitted successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getSubmission(req: Request, res: Response): Promise<void> {
    try {
      const submissionId = parseInt(req.params.submissionId);

      if (!submissionId || isNaN(submissionId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid submission ID',
          errors: ['Submission ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const submission = await this.formBuilderService.getSubmissionById(submissionId);

      const response: ApiResponse = {
        success: true,
        data: submission
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getFormSubmissions(req: Request, res: Response): Promise<void> {
    try {
      const formId = parseInt(req.params.id);
      const { entity_id, start_date, end_date, limit, offset } = req.query;

      if (!formId || isNaN(formId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid form ID',
          errors: ['Form ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const filters: any = {};

      if (entity_id) {
        const entityId = parseInt(entity_id as string);
        if (!isNaN(entityId)) {
          filters.entity_id = entityId;
        }
      }

      if (start_date) {
        filters.start_date = new Date(start_date as string);
      }

      if (end_date) {
        filters.end_date = new Date(end_date as string);
      }

      if (limit) {
        const limitNum = parseInt(limit as string);
        if (!isNaN(limitNum) && limitNum > 0) {
          filters.limit = limitNum;
        }
      }

      if (offset) {
        const offsetNum = parseInt(offset as string);
        if (!isNaN(offsetNum) && offsetNum >= 0) {
          filters.offset = offsetNum;
        }
      }

      const result = await this.formBuilderService.getFormSubmissions(formId, filters);

      const response: ApiResponse = {
        success: true,
        data: result
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getEntitySubmissions(req: Request, res: Response): Promise<void> {
    try {
      const { entity_type, entity_id } = req.params;

      if (!entity_type || !entity_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Missing required parameters',
          errors: ['entity_type and entity_id are required']
        };
        res.status(400).json(response);
        return;
      }

      const entityIdNum = parseInt(entity_id);
      if (isNaN(entityIdNum)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid entity ID',
          errors: ['Entity ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const submissions = await this.formBuilderService.getEntitySubmissions(
        entity_type as EntityType,
        entityIdNum
      );

      const response: ApiResponse = {
        success: true,
        data: submissions
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getFormAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const formId = parseInt(req.params.id);

      if (!formId || isNaN(formId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid form ID',
          errors: ['Form ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const analytics = await this.formBuilderService.getFormAnalytics(formId);

      const response: ApiResponse = {
        success: true,
        data: analytics
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private handleError(res: Response, error: any): void {
    console.error('Form Controller Error:', error);

    if (error instanceof ValidationError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: error.details ? [error.details] : [error.message]
      };
      res.status(400).json(response);
    } else if (error instanceof NotFoundError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(404).json(response);
    } else if (error instanceof ApplicationError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
      };
      res.status(error.statusCode).json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error',
        errors: ['An unexpected error occurred']
      };
      res.status(500).json(response);
    }
  }
}