import React, { useState, useEffect } from 'react';
import { Phase, EpicPhase, PhaseStatus } from '../shared/types';
import { PHASE_COLORS, PHASE_ICONS } from '../../shared/constants/phases';
import './PhaseTimeline.css';

interface PhaseTimelineProps {
  epicId: number;
  phases: Phase[];
  epicPhases: EpicPhase[];
  currentPhaseId: number;
  showDetails?: boolean;
  interactive?: boolean;
  onPhaseClick?: (phaseId: number) => void;
  onPhaseTransition?: (fromPhaseId: number, toPhaseId: number) => void;
}

interface TimelinePhase extends Phase {
  epicPhase: EpicPhase;
  isCurrent: boolean;
  isAccessible: boolean;
  isCompleted: boolean;
  isInProgress: boolean;
  estimatedDuration?: number;
  actualDuration?: number;
}

export const PhaseTimeline: React.FC<PhaseTimelineProps> = ({
  epicId,
  phases,
  epicPhases,
  currentPhaseId,
  showDetails = false,
  interactive = false,
  onPhaseClick,
  onPhaseTransition
}) => {
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<TimelinePhase | null>(null);

  useEffect(() => {
    const enrichedPhases = phases.map(phase => {
      const epicPhase = epicPhases.find(ep => ep.phase_id === phase.id);
      if (!epicPhase) {
        throw new Error(`Epic phase not found for phase ${phase.id}`);
      }

      const isCurrent = phase.id === currentPhaseId;
      const isCompleted = epicPhase.status === PhaseStatus.COMPLETED;
      const isInProgress = epicPhase.status === PhaseStatus.IN_PROGRESS;
      const isAccessible = phase.sequence_order <= getCurrentPhaseSequence();

      let actualDuration: number | undefined;
      if (epicPhase.start_date && epicPhase.end_date) {
        const start = new Date(epicPhase.start_date);
        const end = new Date(epicPhase.end_date);
        actualDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        ...phase,
        epicPhase,
        isCurrent,
        isAccessible,
        isCompleted,
        isInProgress,
        actualDuration
      };
    });

    setTimelinePhases(enrichedPhases);
  }, [phases, epicPhases, currentPhaseId]);

  const getCurrentPhaseSequence = (): number => {
    const currentPhase = phases.find(p => p.id === currentPhaseId);
    return currentPhase ? currentPhase.sequence_order : 1;
  };

  const getPhaseStatusIcon = (phase: TimelinePhase): string => {
    if (phase.isCompleted) return '✓';
    if (phase.isInProgress) return '⟳';
    if (phase.isAccessible) return '○';
    return '○';
  };

  const getPhaseStatusClass = (phase: TimelinePhase): string => {
    if (phase.isCompleted) return 'phase-completed';
    if (phase.isInProgress) return 'phase-in-progress';
    if (phase.isAccessible) return 'phase-accessible';
    return 'phase-locked';
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  const calculateProgress = (): number => {
    const totalPhases = timelinePhases.length;
    const completedPhases = timelinePhases.filter(p => p.isCompleted).length;
    const currentPhaseProgress = timelinePhases.find(p => p.isCurrent)?.epicPhase.completion_percentage || 0;
    
    return Math.round(((completedPhases + (currentPhaseProgress / 100)) / totalPhases) * 100);
  };

  const handlePhaseClick = (phase: TimelinePhase) => {
    if (interactive && phase.isAccessible) {
      setSelectedPhase(phase);
      onPhaseClick?.(phase.id);
    }
  };

  const handlePhaseTransition = (targetPhase: TimelinePhase) => {
    const currentPhase = timelinePhases.find(p => p.isCurrent);
    if (currentPhase && onPhaseTransition) {
      onPhaseTransition(currentPhase.id, targetPhase.id);
    }
  };

  return (
    <div className="phase-timeline">
      {/* Progress Header */}
      <div className="timeline-header">
        <h3>Project Timeline</h3>
        <div className="timeline-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
          <span className="progress-text">{calculateProgress()}% Complete</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline-container">
        <div className="timeline-line" />
        
        {timelinePhases.map((phase, index) => (
          <div
            key={phase.id}
            className={`timeline-phase ${getPhaseStatusClass(phase)} ${
              phase.isCurrent ? 'current' : ''
            } ${interactive && phase.isAccessible ? 'interactive' : ''}`}
            onClick={() => handlePhaseClick(phase)}
          >
            {/* Phase Node */}
            <div className="phase-node">
              <div 
                className="phase-circle"
                style={{ 
                  backgroundColor: phase.isCompleted ? PHASE_COLORS[phase.sequence_order] : 'transparent',
                  borderColor: PHASE_COLORS[phase.sequence_order]
                }}
              >
                <span className="phase-icon">
                  {getPhaseStatusIcon(phase)}
                </span>
              </div>
              
              {index < timelinePhases.length - 1 && (
                <div className="phase-connector" />
              )}
            </div>

            {/* Phase Content */}
            <div className="phase-content">
              <div className="phase-header">
                <h4 className="phase-title">{phase.name}</h4>
                <span className={`phase-status ${phase.epicPhase.status}`}>
                  {phase.epicPhase.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {showDetails && (
                <div className="phase-details">
                  <p className="phase-description">{phase.description}</p>
                  
                  <div className="phase-metrics">
                    <div className="metric">
                      <span className="metric-label">Progress:</span>
                      <div className="metric-progress">
                        <div className="progress-bar small">
                          <div 
                            className="progress-fill"
                            style={{ width: `${phase.epicPhase.completion_percentage}%` }}
                          />
                        </div>
                        <span>{phase.epicPhase.completion_percentage}%</span>
                      </div>
                    </div>

                    <div className="metric">
                      <span className="metric-label">Start Date:</span>
                      <span className="metric-value">
                        {formatDate(phase.epicPhase.start_date)}
                      </span>
                    </div>

                    <div className="metric">
                      <span className="metric-label">End Date:</span>
                      <span className="metric-value">
                        {formatDate(phase.epicPhase.end_date)}
                      </span>
                    </div>

                    {phase.actualDuration && (
                      <div className="metric">
                        <span className="metric-label">Duration:</span>
                        <span className="metric-value">{phase.actualDuration} days</span>
                      </div>
                    )}
                  </div>

                  {phase.epicPhase.notes && (
                    <div className="phase-notes">
                      <span className="notes-label">Notes:</span>
                      <p>{phase.epicPhase.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Actions */}
              {interactive && phase.isAccessible && (
                <div className="phase-actions">
                  {!phase.isCurrent && !phase.isCompleted && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePhaseTransition(phase);
                      }}
                    >
                      Move to {phase.name}
                    </button>
                  )}
                  
                  {phase.isCurrent && (
                    <div className="current-phase-actions">
                      <button className="btn btn-success btn-sm">
                        Mark Complete
                      </button>
                      <button className="btn btn-secondary btn-sm">
                        Update Progress
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Phase Details Modal */}
      {selectedPhase && (
        <PhaseDetailsModal
          phase={selectedPhase}
          onClose={() => setSelectedPhase(null)}
          onUpdate={(updates) => {
            // Handle phase updates
            console.log('Phase updates:', updates);
          }}
        />
      )}
    </div>
  );
};

interface PhaseDetailsModalProps {
  phase: TimelinePhase;
  onClose: () => void;
  onUpdate: (updates: Partial<EpicPhase>) => void;
}

const PhaseDetailsModal: React.FC<PhaseDetailsModalProps> = ({
  phase,
  onClose,
  onUpdate
}) => {
  const [completion, setCompletion] = useState(phase.epicPhase.completion_percentage);
  const [notes, setNotes] = useState(phase.epicPhase.notes || '');

  const handleSave = () => {
    onUpdate({
      completion_percentage: completion,
      notes: notes
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{phase.name} Details</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Completion Percentage</label>
            <input
              type="range"
              min="0"
              max="100"
              value={completion}
              onChange={(e) => setCompletion(Number(e.target.value))}
              className="completion-slider"
            />
            <span className="completion-value">{completion}%</span>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="notes-textarea"
              placeholder="Add notes about this phase..."
            />
          </div>

          <div className="phase-info">
            <div className="info-row">
              <span>Status:</span>
              <span className={`status-badge ${phase.epicPhase.status}`}>
                {phase.epicPhase.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="info-row">
              <span>Start Date:</span>
              <span>{formatDate(phase.epicPhase.start_date)}</span>
            </div>
            <div className="info-row">
              <span>End Date:</span>
              <span>{formatDate(phase.epicPhase.end_date)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const formatDate = (date: Date | string | null): string => {
  if (!date) return 'Not set';
  return new Date(date).toLocaleDateString();
};

export default PhaseTimeline;