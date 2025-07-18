import { PhaseStatus, Phase, EpicPhase } from '../../shared/types';
import { VALID_PHASE_TRANSITIONS, PHASE_SEQUENCE } from '../../shared/constants/phases';
import { ValidationError, ApplicationError } from '../../shared/types';

export interface PhaseTransitionEvent {
  type: 'START_PHASE' | 'COMPLETE_PHASE' | 'MOVE_TO_NEXT' | 'MOVE_TO_PREVIOUS' | 'RESET_PHASE';
  epicId: number;
  currentPhaseId: number;
  targetPhaseId?: number;
  metadata?: {
    userId?: number;
    notes?: string;
    completionPercentage?: number;
    timestamp: Date;
  };
}

export interface PhaseTransitionResult {
  success: boolean;
  newState: PhaseStatus;
  newPhaseId?: number;
  message: string;
  sideEffects?: PhaseTransitionSideEffect[];
}

export interface PhaseTransitionSideEffect {
  type: 'UPDATE_EPIC_PHASE' | 'NOTIFY_USERS' | 'LOG_AUDIT' | 'UPDATE_DEPENDENCIES';
  data: any;
}

export interface PhaseStateMachineContext {
  epicId: number;
  currentPhase: Phase;
  allPhases: Phase[];
  epicPhases: EpicPhase[];
  userPermissions?: {
    canAdvancePhase: boolean;
    canRevertPhase: boolean;
    canSkipPhase: boolean;
  };
}

export class PhaseStateMachine {
  private context: PhaseStateMachineContext;
  private transitionHistory: PhaseTransitionEvent[] = [];

  constructor(context: PhaseStateMachineContext) {
    this.context = context;
  }

  async processTransition(event: PhaseTransitionEvent): Promise<PhaseTransitionResult> {
    this.validateEvent(event);
    
    // Add event to history
    this.transitionHistory.push(event);

    try {
      switch (event.type) {
        case 'START_PHASE':
          return await this.handleStartPhase(event);
        case 'COMPLETE_PHASE':
          return await this.handleCompletePhase(event);
        case 'MOVE_TO_NEXT':
          return await this.handleMoveToNext(event);
        case 'MOVE_TO_PREVIOUS':
          return await this.handleMoveToPrevious(event);
        case 'RESET_PHASE':
          return await this.handleResetPhase(event);
        default:
          throw new ValidationError(`Unknown transition event type: ${event.type}`);
      }
    } catch (error) {
      // Remove failed event from history
      this.transitionHistory.pop();
      throw error;
    }
  }

  private validateEvent(event: PhaseTransitionEvent): void {
    if (!event.epicId || !event.currentPhaseId) {
      throw new ValidationError('Epic ID and current phase ID are required for phase transitions');
    }

    if (event.epicId !== this.context.epicId) {
      throw new ValidationError('Event epic ID does not match context epic ID');
    }

    if (!event.metadata?.timestamp) {
      event.metadata = { ...event.metadata, timestamp: new Date() };
    }
  }

  private async handleStartPhase(event: PhaseTransitionEvent): Promise<PhaseTransitionResult> {
    const currentEpicPhase = this.getCurrentEpicPhase(event.currentPhaseId);
    
    if (currentEpicPhase.status === PhaseStatus.IN_PROGRESS) {
      return {
        success: false,
        newState: currentEpicPhase.status,
        message: 'Phase is already in progress'
      };
    }

    if (currentEpicPhase.status === PhaseStatus.COMPLETED) {
      return {
        success: false,
        newState: currentEpicPhase.status,
        message: 'Cannot start a completed phase. Use RESET_PHASE first if needed.'
      };
    }

    // Check if previous phases are completed
    const canStart = this.canStartPhase(event.currentPhaseId);
    if (!canStart.allowed) {
      return {
        success: false,
        newState: currentEpicPhase.status,
        message: canStart.reason!
      };
    }

    return {
      success: true,
      newState: PhaseStatus.IN_PROGRESS,
      message: `Phase ${this.context.currentPhase.name} started successfully`,
      sideEffects: [
        {
          type: 'UPDATE_EPIC_PHASE',
          data: {
            epicPhaseId: currentEpicPhase.id,
            updates: {
              status: PhaseStatus.IN_PROGRESS,
              start_date: new Date(),
              completion_percentage: 0
            }
          }
        },
        {
          type: 'LOG_AUDIT',
          data: {
            action: 'PHASE_STARTED',
            epicId: event.epicId,
            phaseId: event.currentPhaseId,
            userId: event.metadata?.userId
          }
        }
      ]
    };
  }

  private async handleCompletePhase(event: PhaseTransitionEvent): Promise<PhaseTransitionResult> {
    const currentEpicPhase = this.getCurrentEpicPhase(event.currentPhaseId);
    
    if (currentEpicPhase.status === PhaseStatus.COMPLETED) {
      return {
        success: false,
        newState: currentEpicPhase.status,
        message: 'Phase is already completed'
      };
    }

    if (currentEpicPhase.status === PhaseStatus.NOT_STARTED) {
      return {
        success: false,
        newState: currentEpicPhase.status,
        message: 'Cannot complete a phase that has not been started'
      };
    }

    // Check if all required deliverables are completed
    const canComplete = await this.canCompletePhase(event.currentPhaseId);
    if (!canComplete.allowed) {
      return {
        success: false,
        newState: currentEpicPhase.status,
        message: canComplete.reason!
      };
    }

    return {
      success: true,
      newState: PhaseStatus.COMPLETED,
      message: `Phase ${this.context.currentPhase.name} completed successfully`,
      sideEffects: [
        {
          type: 'UPDATE_EPIC_PHASE',
          data: {
            epicPhaseId: currentEpicPhase.id,
            updates: {
              status: PhaseStatus.COMPLETED,
              end_date: new Date(),
              completion_percentage: 100,
              notes: event.metadata?.notes
            }
          }
        },
        {
          type: 'NOTIFY_USERS',
          data: {
            type: 'PHASE_COMPLETED',
            epicId: event.epicId,
            phaseId: event.currentPhaseId,
            message: `Phase ${this.context.currentPhase.name} has been completed`
          }
        },
        {
          type: 'LOG_AUDIT',
          data: {
            action: 'PHASE_COMPLETED',
            epicId: event.epicId,
            phaseId: event.currentPhaseId,
            userId: event.metadata?.userId
          }
        }
      ]
    };
  }

  private async handleMoveToNext(event: PhaseTransitionEvent): Promise<PhaseTransitionResult> {
    const currentPhase = this.context.currentPhase;
    const nextPhase = this.getNextPhase(currentPhase.sequence_order);

    if (!nextPhase) {
      return {
        success: false,
        newState: PhaseStatus.COMPLETED,
        message: 'Already at the final phase'
      };
    }

    // First complete current phase
    const completeResult = await this.handleCompletePhase({
      ...event,
      type: 'COMPLETE_PHASE'
    });

    if (!completeResult.success) {
      return completeResult;
    }

    // Then start next phase
    const startNextEvent: PhaseTransitionEvent = {
      ...event,
      type: 'START_PHASE',
      currentPhaseId: nextPhase.id,
      targetPhaseId: nextPhase.id
    };

    const startResult = await this.handleStartPhase(startNextEvent);

    if (startResult.success) {
      return {
        success: true,
        newState: PhaseStatus.IN_PROGRESS,
        newPhaseId: nextPhase.id,
        message: `Moved from ${currentPhase.name} to ${nextPhase.name}`,
        sideEffects: [
          ...(completeResult.sideEffects || []),
          ...(startResult.sideEffects || []),
          {
            type: 'UPDATE_EPIC_PHASE',
            data: {
              epicId: event.epicId,
              newCurrentPhaseId: nextPhase.id
            }
          }
        ]
      };
    }

    return startResult;
  }

  private async handleMoveToPrevious(event: PhaseTransitionEvent): Promise<PhaseTransitionResult> {
    const currentPhase = this.context.currentPhase;
    const previousPhase = this.getPreviousPhase(currentPhase.sequence_order);

    if (!previousPhase) {
      return {
        success: false,
        newState: PhaseStatus.IN_PROGRESS,
        message: 'Already at the first phase'
      };
    }

    // Check permissions for phase reversion
    if (!this.context.userPermissions?.canRevertPhase) {
      return {
        success: false,
        newState: PhaseStatus.IN_PROGRESS,
        message: 'Insufficient permissions to revert to previous phase'
      };
    }

    // Reset current phase to not started
    const resetResult = await this.handleResetPhase({
      ...event,
      currentPhaseId: currentPhase.id
    });

    if (!resetResult.success) {
      return resetResult;
    }

    // Reopen previous phase
    const previousEpicPhase = this.getCurrentEpicPhase(previousPhase.id);

    return {
      success: true,
      newState: PhaseStatus.IN_PROGRESS,
      newPhaseId: previousPhase.id,
      message: `Reverted from ${currentPhase.name} to ${previousPhase.name}`,
      sideEffects: [
        {
          type: 'UPDATE_EPIC_PHASE',
          data: {
            epicPhaseId: previousEpicPhase.id,
            updates: {
              status: PhaseStatus.IN_PROGRESS,
              end_date: null,
              completion_percentage: 75 // Assume some progress was made
            }
          }
        },
        {
          type: 'UPDATE_EPIC_PHASE',
          data: {
            epicId: event.epicId,
            newCurrentPhaseId: previousPhase.id
          }
        },
        {
          type: 'LOG_AUDIT',
          data: {
            action: 'PHASE_REVERTED',
            epicId: event.epicId,
            fromPhaseId: currentPhase.id,
            toPhaseId: previousPhase.id,
            userId: event.metadata?.userId,
            reason: event.metadata?.notes
          }
        }
      ]
    };
  }

  private async handleResetPhase(event: PhaseTransitionEvent): Promise<PhaseTransitionResult> {
    const currentEpicPhase = this.getCurrentEpicPhase(event.currentPhaseId);
    
    if (currentEpicPhase.status === PhaseStatus.NOT_STARTED) {
      return {
        success: false,
        newState: currentEpicPhase.status,
        message: 'Phase is already in not started state'
      };
    }

    return {
      success: true,
      newState: PhaseStatus.NOT_STARTED,
      message: `Phase ${this.context.currentPhase.name} has been reset`,
      sideEffects: [
        {
          type: 'UPDATE_EPIC_PHASE',
          data: {
            epicPhaseId: currentEpicPhase.id,
            updates: {
              status: PhaseStatus.NOT_STARTED,
              start_date: null,
              end_date: null,
              completion_percentage: 0,
              notes: event.metadata?.notes ? `RESET: ${event.metadata.notes}` : 'Phase reset'
            }
          }
        },
        {
          type: 'LOG_AUDIT',
          data: {
            action: 'PHASE_RESET',
            epicId: event.epicId,
            phaseId: event.currentPhaseId,
            userId: event.metadata?.userId,
            reason: event.metadata?.notes
          }
        }
      ]
    };
  }

  private canStartPhase(phaseId: number): { allowed: boolean; reason?: string } {
    const phase = this.context.allPhases.find(p => p.id === phaseId);
    if (!phase) {
      return { allowed: false, reason: 'Phase not found' };
    }

    // First phase can always be started
    if (phase.sequence_order === 1) {
      return { allowed: true };
    }

    // Check if all previous phases are completed
    const previousPhases = this.context.allPhases.filter(p => p.sequence_order < phase.sequence_order);
    const incompletePreviousPhases = previousPhases.filter(prevPhase => {
      const epicPhase = this.getCurrentEpicPhase(prevPhase.id);
      return epicPhase.status !== PhaseStatus.COMPLETED;
    });

    if (incompletePreviousPhases.length > 0) {
      const phaseNames = incompletePreviousPhases.map(p => p.name).join(', ');
      return { 
        allowed: false, 
        reason: `Cannot start ${phase.name}. Please complete the following phases first: ${phaseNames}` 
      };
    }

    return { allowed: true };
  }

  private async canCompletePhase(phaseId: number): Promise<{ allowed: boolean; reason?: string }> {
    const phase = this.context.allPhases.find(p => p.id === phaseId);
    if (!phase) {
      return { allowed: false, reason: 'Phase not found' };
    }

    // Check if all stories in this phase are completed
    // This would require additional database queries in a real implementation
    // For now, we'll assume the phase can be completed if it's in progress
    
    const epicPhase = this.getCurrentEpicPhase(phaseId);
    
    // Phase must be at least 80% complete to be marked as completed
    if (epicPhase.completion_percentage < 80) {
      return { 
        allowed: false, 
        reason: `Phase must be at least 80% complete. Current: ${epicPhase.completion_percentage}%` 
      };
    }

    return { allowed: true };
  }

  private getCurrentEpicPhase(phaseId: number): EpicPhase {
    const epicPhase = this.context.epicPhases.find(ep => ep.phase_id === phaseId);
    if (!epicPhase) {
      throw new ValidationError(`Epic phase not found for phase ID ${phaseId}`);
    }
    return epicPhase;
  }

  private getNextPhase(currentSequenceOrder: number): Phase | undefined {
    return this.context.allPhases.find(p => p.sequence_order === currentSequenceOrder + 1);
  }

  private getPreviousPhase(currentSequenceOrder: number): Phase | undefined {
    return this.context.allPhases.find(p => p.sequence_order === currentSequenceOrder - 1);
  }

  public getAvailableTransitions(): { [key: string]: boolean } {
    const currentPhase = this.context.currentPhase;
    const currentEpicPhase = this.getCurrentEpicPhase(currentPhase.id);
    const nextPhase = this.getNextPhase(currentPhase.sequence_order);
    const previousPhase = this.getPreviousPhase(currentPhase.sequence_order);

    return {
      canStart: currentEpicPhase.status === PhaseStatus.NOT_STARTED,
      canComplete: currentEpicPhase.status === PhaseStatus.IN_PROGRESS,
      canMoveToNext: currentEpicPhase.status === PhaseStatus.IN_PROGRESS && !!nextPhase,
      canMoveToPrevious: !!previousPhase && (this.context.userPermissions?.canRevertPhase || false),
      canReset: currentEpicPhase.status !== PhaseStatus.NOT_STARTED,
      canSkip: this.context.userPermissions?.canSkipPhase || false
    };
  }

  public getTransitionHistory(): PhaseTransitionEvent[] {
    return [...this.transitionHistory];
  }

  public validateTransitionSequence(): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // Check if phases follow correct sequence
    for (let i = 1; i < this.transitionHistory.length; i++) {
      const current = this.transitionHistory[i];
      const previous = this.transitionHistory[i - 1];
      
      // Add custom validation logic here
      if (current.type === 'MOVE_TO_NEXT' && previous.type !== 'COMPLETE_PHASE') {
        violations.push(`Invalid transition: Cannot move to next phase without completing current phase at ${current.metadata?.timestamp}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }
}