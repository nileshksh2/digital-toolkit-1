import { Request, Response } from 'express';
import { CustomerPortalService } from '../../modules/customer-portal/customer-portal-service';
import { ApiResponse, CreateCommentRequest } from '../../shared/types';
import { ValidationError, NotFoundError, ApplicationError } from '../../shared/types';

export class CustomerPortalController {
  constructor(private customerPortalService: CustomerPortalService) {}

  async getPortalData(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;

      if (!portalKey) {
        const response: ApiResponse = {
          success: false,
          message: 'Portal key is required',
          errors: ['Portal key must be provided in the URL']
        };
        res.status(400).json(response);
        return;
      }

      const portalData = await this.customerPortalService.getPortalData(portalKey);

      const response: ApiResponse = {
        success: true,
        data: portalData
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async createPortalUrl(req: Request, res: Response): Promise<void> {
    try {
      const { epic_id, customer_id } = req.body;

      if (!epic_id || !customer_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Epic ID and Customer ID are required',
          errors: ['Both epic_id and customer_id must be provided']
        };
        res.status(400).json(response);
        return;
      }

      const portalKey = await this.customerPortalService.createPortalUrl(epic_id, customer_id);

      const response: ApiResponse = {
        success: true,
        data: {
          portal_key: portalKey,
          portal_url: `/portal/${portalKey}`
        },
        message: 'Customer portal URL created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updatePortalSettings(req: Request, res: Response): Promise<void> {
    try {
      const { customer_id, epic_id, visibility_settings, custom_branding } = req.body;

      if (!customer_id || !epic_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Customer ID and Epic ID are required',
          errors: ['Both customer_id and epic_id must be provided']
        };
        res.status(400).json(response);
        return;
      }

      let updatedSettings;

      if (visibility_settings) {
        updatedSettings = await this.customerPortalService.updateVisibilitySettings(
          customer_id,
          epic_id,
          visibility_settings
        );
      }

      if (custom_branding) {
        updatedSettings = await this.customerPortalService.updatePortalBranding(
          customer_id,
          epic_id,
          custom_branding
        );
      }

      if (!visibility_settings && !custom_branding) {
        updatedSettings = await this.customerPortalService.createOrUpdatePortalSettings(
          customer_id,
          epic_id,
          req.body.visibility_settings || {},
          req.body.custom_branding
        );
      }

      const response: ApiResponse = {
        success: true,
        data: updatedSettings,
        message: 'Portal settings updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getPortalSettings(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      const epicId = parseInt(req.params.epicId);

      if (!customerId || !epicId) {
        const response: ApiResponse = {
          success: false,
          message: 'Customer ID and Epic ID are required',
          errors: ['Valid customer_id and epic_id must be provided']
        };
        res.status(400).json(response);
        return;
      }

      const settings = await this.customerPortalService.getPortalSettings(customerId, epicId);

      const response: ApiResponse = {
        success: true,
        data: settings
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async submitComment(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;
      const { entity_type, entity_id, content, author_email } = req.body;

      if (!portalKey || !entity_type || !entity_id || !content || !author_email) {
        const response: ApiResponse = {
          success: false,
          message: 'Missing required fields',
          errors: ['portal_key, entity_type, entity_id, content, and author_email are required']
        };
        res.status(400).json(response);
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(author_email)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid email format',
          errors: ['Please provide a valid email address']
        };
        res.status(400).json(response);
        return;
      }

      const comment = await this.customerPortalService.submitCustomerComment({
        portal_key: portalKey,
        entity_type,
        entity_id,
        content,
        attachments: req.files as Express.Multer.File[],
        author_email
      });

      const response: ApiResponse = {
        success: true,
        data: comment,
        message: 'Comment submitted successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getComments(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;

      if (!portalKey) {
        const response: ApiResponse = {
          success: false,
          message: 'Portal key is required',
          errors: ['Portal key must be provided in the URL']
        };
        res.status(400).json(response);
        return;
      }

      // First verify portal access and get epic ID
      const portalData = await this.customerPortalService.getPortalData(portalKey);
      const comments = await this.customerPortalService.getCustomerComments(portalData.epic.id);

      const response: ApiResponse = {
        success: true,
        data: comments
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;
      const format = req.query.format as 'pdf' | 'excel' || 'pdf';

      if (!portalKey) {
        const response: ApiResponse = {
          success: false,
          message: 'Portal key is required',
          errors: ['Portal key must be provided in the URL']
        };
        res.status(400).json(response);
        return;
      }

      if (!['pdf', 'excel'].includes(format)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid format',
          errors: ['Format must be either "pdf" or "excel"']
        };
        res.status(400).json(response);
        return;
      }

      const reportBuffer = await this.customerPortalService.generatePortalReport(portalKey, format);

      // Set appropriate headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `project-report-${timestamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      
      res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', reportBuffer.length);

      res.send(reportBuffer);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getPortalProgress(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;

      if (!portalKey) {
        const response: ApiResponse = {
          success: false,
          message: 'Portal key is required',
          errors: ['Portal key must be provided in the URL']
        };
        res.status(400).json(response);
        return;
      }

      const portalData = await this.customerPortalService.getPortalData(portalKey);

      const response: ApiResponse = {
        success: true,
        data: {
          epic: {
            id: portalData.epic.id,
            title: portalData.epic.title,
            status: portalData.epic.status
          },
          progress: portalData.progress_summary,
          last_updated: new Date()
        }
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getPortalStories(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;

      if (!portalKey) {
        const response: ApiResponse = {
          success: false,
          message: 'Portal key is required',
          errors: ['Portal key must be provided in the URL']
        };
        res.status(400).json(response);
        return;
      }

      const portalData = await this.customerPortalService.getPortalData(portalKey);

      const response: ApiResponse = {
        success: true,
        data: portalData.stories
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getRecentUpdates(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;

      if (!portalKey) {
        const response: ApiResponse = {
          success: false,
          message: 'Portal key is required',
          errors: ['Portal key must be provided in the URL']
        };
        res.status(400).json(response);
        return;
      }

      const portalData = await this.customerPortalService.getPortalData(portalKey);

      const response: ApiResponse = {
        success: true,
        data: portalData.recent_updates
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Public endpoint for portal existence check (no authentication required)
  async validatePortalKey(req: Request, res: Response): Promise<void> {
    try {
      const portalKey = req.params.portalKey;

      if (!portalKey) {
        const response: ApiResponse = {
          success: false,
          message: 'Portal key is required',
          errors: ['Portal key must be provided in the URL']
        };
        res.status(400).json(response);
        return;
      }

      try {
        const portalData = await this.customerPortalService.getPortalData(portalKey);
        
        const response: ApiResponse = {
          success: true,
          data: {
            valid: true,
            customer_name: portalData.customer.name,
            epic_title: portalData.epic.title,
            custom_branding: portalData.custom_branding
          }
        };

        res.json(response);
      } catch (error) {
        if (error instanceof NotFoundError) {
          const response: ApiResponse = {
            success: true,
            data: {
              valid: false
            }
          };
          res.json(response);
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private handleError(res: Response, error: any): void {
    console.error('Customer Portal Controller Error:', error);

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