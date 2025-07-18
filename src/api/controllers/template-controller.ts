import { Request, Response } from 'express';
import { TemplateService } from '../../modules/templates/template-service';
import { ApiResponse } from '../../shared/types';
import { ValidationError, NotFoundError, ApplicationError } from '../../shared/types';

export class TemplateController {
  constructor(private templateService: TemplateService) {}

  async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { category, is_active, created_by, search } = req.query;

      const filters: any = {};
      if (category) filters.category = category as string;
      if (is_active !== undefined) filters.is_active = is_active === 'true';
      if (created_by) filters.created_by = parseInt(created_by as string);
      if (search) filters.search = search as string;

      const templates = await this.templateService.getAllTemplates(filters);

      const response: ApiResponse = {
        success: true,
        data: templates
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, category, structure } = req.body;
      const created_by = req.user?.id;

      if (!name || !category || !structure) {
        const response: ApiResponse = {
          success: false,
          message: 'Missing required fields',
          errors: ['name, category, and structure are required']
        };
        res.status(400).json(response);
        return;
      }

      const template = await this.templateService.createTemplate({
        name,
        description,
        category,
        structure,
        created_by
      });

      const response: ApiResponse = {
        success: true,
        data: template,
        message: 'Template created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const template = await this.templateService.getTemplateById(templateId);

      const response: ApiResponse = {
        success: true,
        data: template
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);
      const updates = req.body;
      const updated_by = req.user?.id;

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const template = await this.templateService.updateTemplate(templateId, {
        ...updates,
        updated_by
      });

      const response: ApiResponse = {
        success: true,
        data: template,
        message: 'Template updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      await this.templateService.deleteTemplate(templateId);

      const response: ApiResponse = {
        success: true,
        message: 'Template deleted successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async duplicateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);
      const { new_name } = req.body;
      const duplicated_by = req.user?.id;

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!new_name) {
        const response: ApiResponse = {
          success: false,
          message: 'New template name is required',
          errors: ['new_name must be provided']
        };
        res.status(400).json(response);
        return;
      }

      const duplicatedTemplate = await this.templateService.duplicateTemplate(
        templateId,
        new_name,
        duplicated_by
      );

      const response: ApiResponse = {
        success: true,
        data: duplicatedTemplate,
        message: 'Template duplicated successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async applyTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);
      const { epic_id, customizations } = req.body;

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!epic_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Epic ID is required',
          errors: ['epic_id must be provided']
        };
        res.status(400).json(response);
        return;
      }

      const appliedTemplate = await this.templateService.applyTemplateToEpic(
        templateId,
        epic_id,
        customizations
      );

      const response: ApiResponse = {
        success: true,
        data: appliedTemplate,
        message: 'Template applied successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getTemplateVersions(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const versions = await this.templateService.getTemplateVersions(templateId);

      const response: ApiResponse = {
        success: true,
        data: versions
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async createTemplateVersion(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);
      const { structure, change_notes } = req.body;
      const created_by = req.user?.id;

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!structure) {
        const response: ApiResponse = {
          success: false,
          message: 'Structure is required',
          errors: ['structure must be provided']
        };
        res.status(400).json(response);
        return;
      }

      const version = await this.templateService.createTemplateVersion(
        templateId,
        structure,
        change_notes,
        created_by
      );

      const response: ApiResponse = {
        success: true,
        data: version,
        message: 'Template version created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getTemplateAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const templateId = parseInt(req.params.id);

      if (!templateId || isNaN(templateId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid template ID',
          errors: ['Template ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const analytics = await this.templateService.getTemplateAnalytics(templateId);

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
    console.error('Template Controller Error:', error);

    if (error instanceof ValidationError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
        errors: [error.message]
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