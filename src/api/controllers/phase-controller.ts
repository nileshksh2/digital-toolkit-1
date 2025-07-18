import { Request, Response } from 'express';
import { PhaseService } from '../../modules/phase-tracking/phase-service';
import { ApiResponse } from '../../shared/types';
import { ValidationError, NotFoundError, ApplicationError } from '../../shared/types';

export class PhaseController {
  constructor(private phaseService: PhaseService) {}

  async getAllPhases(req: Request, res: Response): Promise<void> {
    try {
      const phases = await this.phaseService.getAllPhases();

      const response: ApiResponse = {
        success: true,
        data: phases
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getEpicPhases(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.epicId);

      if (!epicId || isNaN(epicId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid epic ID',
          errors: ['Epic ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const phases = await this.phaseService.getEpicPhases(epicId);

      const response: ApiResponse = {
        success: true,
        data: phases
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getCurrentPhase(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.epicId);

      if (!epicId || isNaN(epicId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid epic ID',
          errors: ['Epic ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const currentPhase = await this.phaseService.getCurrentPhase(epicId);

      const response: ApiResponse = {
        success: true,
        data: currentPhase
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async transitionToNextPhase(req: Request, res: Response): Promise<void> {
    try {
      const { epic_id, completed_by, notes } = req.body;
      const user_id = req.user?.id;

      if (!epic_id) {
        const response: ApiResponse = {
          success: false,
          message: 'Epic ID is required',
          errors: ['epic_id must be provided']
        };
        res.status(400).json(response);
        return;
      }

      const transition = await this.phaseService.transitionToNextPhase(
        epic_id,
        completed_by || user_id,
        notes
      );

      const response: ApiResponse = {
        success: true,
        data: transition,
        message: 'Phase transition completed successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async updatePhaseProgress(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.epicId);
      const phaseId = parseInt(req.params.phaseId);
      const { completion_percentage, notes } = req.body;
      const updated_by = req.user?.id;

      if (!epicId || isNaN(epicId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid epic ID',
          errors: ['Epic ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (!phaseId || isNaN(phaseId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid phase ID',
          errors: ['Phase ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      if (completion_percentage === undefined || completion_percentage < 0 || completion_percentage > 100) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid completion percentage',
          errors: ['Completion percentage must be between 0 and 100']
        };
        res.status(400).json(response);
        return;
      }

      const updatedPhase = await this.phaseService.updatePhaseProgress(
        epicId,
        phaseId,
        completion_percentage,
        updated_by,
        notes
      );

      const response: ApiResponse = {
        success: true,
        data: updatedPhase,
        message: 'Phase progress updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getPhaseTimeline(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.epicId);

      if (!epicId || isNaN(epicId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid epic ID',
          errors: ['Epic ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const timeline = await this.phaseService.generatePhaseTimeline(epicId);

      const response: ApiResponse = {
        success: true,
        data: timeline
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getPhaseAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const epicId = parseInt(req.params.epicId);

      if (!epicId || isNaN(epicId)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid epic ID',
          errors: ['Epic ID must be a valid number']
        };
        res.status(400).json(response);
        return;
      }

      const analytics = await this.phaseService.getPhaseAnalytics(epicId);

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
    console.error('Phase Controller Error:', error);

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