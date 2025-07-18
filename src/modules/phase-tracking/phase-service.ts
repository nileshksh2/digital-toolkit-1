import { Phase, EpicPhase, PhaseStatus, Epic } from '../../shared/types';
import { DEFAULT_PHASES, VALID_PHASE_TRANSITIONS, PHASE_SEQUENCE } from '../../shared/constants/phases';
import { DatabaseConnection, QueryBuilder } from '../../shared/types';
import { NotFoundError, ValidationError, ApplicationError } from '../../shared/types';

export class PhaseService {
  constructor(private db: DatabaseConnection) {}

  async initializeDefaultPhases(): Promise<Phase[]> {
    const existingPhases = await this.getAllPhases();
    
    if (existingPhases.length > 0) {
      return existingPhases;
    }

    const phases: Phase[] = [];
    
    for (const phaseData of DEFAULT_PHASES) {
      const phase = await this.createPhase(phaseData);
      phases.push(phase);
    }

    return phases;
  }

  async getAllPhases(): Promise<Phase[]> {
    const query = `
      SELECT id, name, sequence_order, description, is_active, created_at, updated_at
      FROM phases 
      WHERE is_active = true 
      ORDER BY sequence_order ASC
    `;
    
    return await this.db.query(query);
  }

  async getPhaseById(id: number): Promise<Phase> {
    const query = `
      SELECT id, name, sequence_order, description, is_active, created_at, updated_at
      FROM phases 
      WHERE id = ? AND is_active = true
    `;
    
    const phase = await this.db.queryFirst(query, [id]);
    
    if (!phase) {
      throw new NotFoundError('Phase', id);
    }
    
    return phase;
  }

  async createPhase(phaseData: Omit<Phase, 'id' | 'created_at' | 'updated_at'>): Promise<Phase> {
    const { name, sequence_order, description, is_active = true } = phaseData;

    // Validate sequence order uniqueness
    const existingPhase = await this.db.queryFirst(
      'SELECT id FROM phases WHERE sequence_order = ? AND is_active = true',
      [sequence_order]
    );

    if (existingPhase) {
      throw new ValidationError(`Phase with sequence order ${sequence_order} already exists`);
    }

    const query = `
      INSERT INTO phases (name, sequence_order, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    const result = await this.db.query(query, [name, sequence_order, description, is_active]);
    const phaseId = result.insertId;
    
    return await this.getPhaseById(phaseId);
  }

  async updatePhase(id: number, updates: Partial<Omit<Phase, 'id' | 'created_at' | 'updated_at'>>): Promise<Phase> {
    const existingPhase = await this.getPhaseById(id);
    
    if (updates.sequence_order && updates.sequence_order !== existingPhase.sequence_order) {
      const conflictingPhase = await this.db.queryFirst(
        'SELECT id FROM phases WHERE sequence_order = ? AND id != ? AND is_active = true',
        [updates.sequence_order, id]
      );

      if (conflictingPhase) {
        throw new ValidationError(`Phase with sequence order ${updates.sequence_order} already exists`);
      }
    }

    const updateFields = [];
    const updateValues = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return existingPhase;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `UPDATE phases SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    return await this.getPhaseById(id);
  }

  async deletePhase(id: number): Promise<void> {
    const phase = await this.getPhaseById(id);
    
    // Check if phase is being used by any epics
    const epicCount = await this.db.queryFirst(
      'SELECT COUNT(*) as count FROM epics WHERE current_phase_id = ?',
      [id]
    );

    if (epicCount.count > 0) {
      throw new ValidationError(`Cannot delete phase '${phase.name}' as it is currently being used by ${epicCount.count} epic(s)`);
    }

    // Soft delete by setting is_active to false
    await this.db.query(
      'UPDATE phases SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  async initializeEpicPhases(epicId: number): Promise<EpicPhase[]> {
    const phases = await this.getAllPhases();
    const epicPhases: EpicPhase[] = [];

    for (const phase of phases) {
      const epicPhase = await this.createEpicPhase({
        epic_id: epicId,
        phase_id: phase.id,
        status: phase.sequence_order === 1 ? PhaseStatus.IN_PROGRESS : PhaseStatus.NOT_STARTED,
        completion_percentage: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      epicPhases.push(epicPhase);
    }

    return epicPhases;
  }

  async createEpicPhase(epicPhaseData: Omit<EpicPhase, 'id'>): Promise<EpicPhase> {
    const {
      epic_id,
      phase_id,
      status = PhaseStatus.NOT_STARTED,
      start_date,
      end_date,
      completion_percentage = 0,
      notes
    } = epicPhaseData;

    const query = `
      INSERT INTO epic_phases (epic_id, phase_id, status, start_date, end_date, completion_percentage, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      epic_id,
      phase_id,
      status,
      start_date,
      end_date,
      completion_percentage,
      notes
    ]);

    return await this.getEpicPhaseById(result.insertId);
  }

  async getEpicPhaseById(id: number): Promise<EpicPhase> {
    const query = `
      SELECT ep.*, p.name as phase_name, p.sequence_order
      FROM epic_phases ep
      JOIN phases p ON ep.phase_id = p.id
      WHERE ep.id = ?
    `;

    const epicPhase = await this.db.queryFirst(query, [id]);

    if (!epicPhase) {
      throw new NotFoundError('EpicPhase', id);
    }

    return epicPhase;
  }

  async getEpicPhases(epicId: number): Promise<EpicPhase[]> {
    const query = `
      SELECT ep.*, p.name as phase_name, p.sequence_order, p.description as phase_description
      FROM epic_phases ep
      JOIN phases p ON ep.phase_id = p.id
      WHERE ep.epic_id = ?
      ORDER BY p.sequence_order ASC
    `;

    return await this.db.query(query, [epicId]);
  }

  async updateEpicPhase(id: number, updates: Partial<Omit<EpicPhase, 'id' | 'epic_id' | 'phase_id' | 'created_at'>>): Promise<EpicPhase> {
    const existingEpicPhase = await this.getEpicPhaseById(id);

    const updateFields = [];
    const updateValues = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });

    if (updateFields.length === 0) {
      return existingEpicPhase;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const query = `UPDATE epic_phases SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.query(query, updateValues);

    return await this.getEpicPhaseById(id);
  }

  async canTransitionToPhase(epicId: number, targetPhaseId: number): Promise<boolean> {
    const targetPhase = await this.getPhaseById(targetPhaseId);
    const epicPhases = await this.getEpicPhases(epicId);

    // Check if target phase exists in epic phases
    const targetEpicPhase = epicPhases.find(ep => ep.phase_id === targetPhaseId);
    if (!targetEpicPhase) {
      throw new ValidationError(`Phase ${targetPhase.name} is not associated with this epic`);
    }

    // Check if previous phases are completed
    const previousPhases = epicPhases.filter(ep => ep.sequence_order < targetPhase.sequence_order);
    const incompletePreviousPhases = previousPhases.filter(ep => ep.status !== PhaseStatus.COMPLETED);

    if (incompletePreviousPhases.length > 0) {
      const phaseNames = incompletePreviousPhases.map(ep => ep.phase_name).join(', ');
      throw new ValidationError(`Cannot transition to ${targetPhase.name}. Please complete the following phases first: ${phaseNames}`);
    }

    return true;
  }

  async transitionEpicToPhase(epicId: number, targetPhaseId: number, notes?: string): Promise<Epic> {
    await this.canTransitionToPhase(epicId, targetPhaseId);

    const transaction = await this.db.beginTransaction();

    try {
      // Update current epic phase to completed if transitioning forward
      const currentEpic = await this.db.queryFirst(
        'SELECT current_phase_id FROM epics WHERE id = ?',
        [epicId]
      );

      if (currentEpic) {
        const currentPhase = await this.getPhaseById(currentEpic.current_phase_id);
        const targetPhase = await this.getPhaseById(targetPhaseId);

        if (targetPhase.sequence_order > currentPhase.sequence_order) {
          // Mark current phase as completed
          await this.db.query(`
            UPDATE epic_phases 
            SET status = ?, completion_percentage = 100, end_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
            WHERE epic_id = ? AND phase_id = ?
          `, [PhaseStatus.COMPLETED, epicId, currentEpic.current_phase_id]);
        }
      }

      // Update target epic phase
      await this.db.query(`
        UPDATE epic_phases 
        SET status = ?, start_date = CURRENT_DATE, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE epic_id = ? AND phase_id = ?
      `, [PhaseStatus.IN_PROGRESS, notes, epicId, targetPhaseId]);

      // Update epic's current phase
      await this.db.query(`
        UPDATE epics 
        SET current_phase_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [targetPhaseId, epicId]);

      await transaction.commit();

      // Return updated epic
      return await this.db.queryFirst(`
        SELECT e.*, p.name as current_phase_name 
        FROM epics e 
        JOIN phases p ON e.current_phase_id = p.id 
        WHERE e.id = ?
      `, [epicId]);

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updatePhaseProgress(epicId: number, phaseId: number, completionPercentage: number): Promise<EpicPhase> {
    if (completionPercentage < 0 || completionPercentage > 100) {
      throw new ValidationError('Completion percentage must be between 0 and 100');
    }

    const epicPhases = await this.getEpicPhases(epicId);
    const epicPhase = epicPhases.find(ep => ep.phase_id === phaseId);

    if (!epicPhase) {
      throw new NotFoundError('EpicPhase for the specified epic and phase');
    }

    const updates: Partial<EpicPhase> = {
      completion_percentage: completionPercentage
    };

    // Auto-update status based on completion percentage
    if (completionPercentage === 0) {
      updates.status = PhaseStatus.NOT_STARTED;
      updates.start_date = null;
      updates.end_date = null;
    } else if (completionPercentage === 100) {
      updates.status = PhaseStatus.COMPLETED;
      if (!epicPhase.end_date) {
        updates.end_date = new Date();
      }
    } else {
      updates.status = PhaseStatus.IN_PROGRESS;
      if (!epicPhase.start_date) {
        updates.start_date = new Date();
      }
    }

    return await this.updateEpicPhase(epicPhase.id, updates);
  }

  async getPhaseProgress(epicId: number): Promise<{
    overall_completion: number;
    phase_progress: Record<number, number>;
    current_phase: Phase;
    next_phase?: Phase;
  }> {
    const epicPhases = await this.getEpicPhases(epicId);
    const phases = await this.getAllPhases();

    const phaseProgress: Record<number, number> = {};
    let totalCompletion = 0;

    epicPhases.forEach(ep => {
      phaseProgress[ep.phase_id] = ep.completion_percentage;
      totalCompletion += ep.completion_percentage;
    });

    const overallCompletion = Math.round(totalCompletion / epicPhases.length);

    // Get current epic info
    const epic = await this.db.queryFirst(
      'SELECT current_phase_id FROM epics WHERE id = ?',
      [epicId]
    );

    const currentPhase = await this.getPhaseById(epic.current_phase_id);
    const nextPhase = phases.find(p => p.sequence_order === currentPhase.sequence_order + 1);

    return {
      overall_completion: overallCompletion,
      phase_progress: phaseProgress,
      current_phase: currentPhase,
      next_phase: nextPhase
    };
  }

  async getPhaseTimeline(epicId: number): Promise<Array<{
    phase: Phase;
    epic_phase: EpicPhase;
    estimated_duration?: number;
    actual_duration?: number;
    is_current: boolean;
    is_accessible: boolean;
  }>> {
    const epicPhases = await this.getEpicPhases(epicId);
    const phases = await this.getAllPhases();
    
    const epic = await this.db.queryFirst(
      'SELECT current_phase_id FROM epics WHERE id = ?',
      [epicId]
    );

    const currentPhase = await this.getPhaseById(epic.current_phase_id);

    return phases.map(phase => {
      const epicPhase = epicPhases.find(ep => ep.phase_id === phase.id);
      
      let actualDuration: number | undefined;
      if (epicPhase?.start_date && epicPhase?.end_date) {
        const start = new Date(epicPhase.start_date);
        const end = new Date(epicPhase.end_date);
        actualDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        phase,
        epic_phase: epicPhase!,
        actual_duration,
        is_current: phase.id === currentPhase.id,
        is_accessible: phase.sequence_order <= currentPhase.sequence_order
      };
    });
  }
}