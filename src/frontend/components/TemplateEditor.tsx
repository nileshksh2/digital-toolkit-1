import React, { useState, useEffect, useCallback } from 'react';
import { 
  TemplateConfiguration, 
  PredefinedStory, 
  PredefinedTask, 
  PredefinedSubtask, 
  Phase, 
  WorkflowRule,
  Priority 
} from '../../shared/types';
import './TemplateEditor.css';

interface TemplateEditorProps {
  initialConfiguration?: TemplateConfiguration;
  phases: Phase[];
  onSave: (configuration: TemplateConfiguration) => void;
  onCancel: () => void;
  readOnly?: boolean;
}

interface DragItem {
  type: 'story' | 'task' | 'subtask';
  id: string;
  data: PredefinedStory | PredefinedTask | PredefinedSubtask;
  sourceIndex?: number;
  sourceParentId?: string;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  initialConfiguration,
  phases,
  onSave,
  onCancel,
  readOnly = false
}) => {
  const [configuration, setConfiguration] = useState<TemplateConfiguration>(
    initialConfiguration || {
      default_phases: [],
      predefined_stories: [],
      form_configurations: [],
      workflow_rules: []
    }
  );

  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);

  // Generate unique IDs for items
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const toggleExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const addStory = () => {
    const newStory: PredefinedStory & { id: string } = {
      id: generateId(),
      title: 'New Story',
      description: '',
      phase_id: selectedPhase || phases[0]?.id || 1,
      estimated_hours: 0,
      predefined_tasks: []
    };

    setConfiguration(prev => ({
      ...prev,
      predefined_stories: [...prev.predefined_stories, newStory]
    }));
  };

  const addTask = (storyId: string) => {
    const newTask: PredefinedTask & { id: string } = {
      id: generateId(),
      title: 'New Task',
      description: '',
      estimated_hours: 0,
      predefined_subtasks: []
    };

    setConfiguration(prev => ({
      ...prev,
      predefined_stories: prev.predefined_stories.map(story => {
        if ((story as any).id === storyId) {
          return {
            ...story,
            predefined_tasks: [...story.predefined_tasks, newTask]
          };
        }
        return story;
      })
    }));

    // Auto-expand parent story
    setExpandedItems(prev => new Set([...prev, storyId]));
  };

  const addSubtask = (storyId: string, taskId: string) => {
    const newSubtask: PredefinedSubtask & { id: string } = {
      id: generateId(),
      title: 'New Subtask',
      description: '',
      estimated_hours: 0
    };

    setConfiguration(prev => ({
      ...prev,
      predefined_stories: prev.predefined_stories.map(story => {
        if ((story as any).id === storyId) {
          return {
            ...story,
            predefined_tasks: story.predefined_tasks.map(task => {
              if ((task as any).id === taskId) {
                return {
                  ...task,
                  predefined_subtasks: [...task.predefined_subtasks, newSubtask]
                };
              }
              return task;
            })
          };
        }
        return story;
      })
    }));

    // Auto-expand parent task
    setExpandedItems(prev => new Set([...prev, storyId, taskId]));
  };

  const updateStory = (storyId: string, updates: Partial<PredefinedStory>) => {
    setConfiguration(prev => ({
      ...prev,
      predefined_stories: prev.predefined_stories.map(story => {
        if ((story as any).id === storyId) {
          return { ...story, ...updates };
        }
        return story;
      })
    }));
  };

  const updateTask = (storyId: string, taskId: string, updates: Partial<PredefinedTask>) => {
    setConfiguration(prev => ({
      ...prev,
      predefined_stories: prev.predefined_stories.map(story => {
        if ((story as any).id === storyId) {
          return {
            ...story,
            predefined_tasks: story.predefined_tasks.map(task => {
              if ((task as any).id === taskId) {
                return { ...task, ...updates };
              }
              return task;
            })
          };
        }
        return story;
      })
    }));
  };

  const updateSubtask = (storyId: string, taskId: string, subtaskId: string, updates: Partial<PredefinedSubtask>) => {
    setConfiguration(prev => ({
      ...prev,
      predefined_stories: prev.predefined_stories.map(story => {
        if ((story as any).id === storyId) {
          return {
            ...story,
            predefined_tasks: story.predefined_tasks.map(task => {
              if ((task as any).id === taskId) {
                return {
                  ...task,
                  predefined_subtasks: task.predefined_subtasks.map(subtask => {
                    if ((subtask as any).id === subtaskId) {
                      return { ...subtask, ...updates };
                    }
                    return subtask;
                  })
                };
              }
              return task;
            })
          };
        }
        return story;
      })
    }));
  };

  const deleteItem = (type: 'story' | 'task' | 'subtask', storyId: string, taskId?: string, subtaskId?: string) => {
    if (type === 'story') {
      setConfiguration(prev => ({
        ...prev,
        predefined_stories: prev.predefined_stories.filter(story => (story as any).id !== storyId)
      }));
    } else if (type === 'task' && taskId) {
      setConfiguration(prev => ({
        ...prev,
        predefined_stories: prev.predefined_stories.map(story => {
          if ((story as any).id === storyId) {
            return {
              ...story,
              predefined_tasks: story.predefined_tasks.filter(task => (task as any).id !== taskId)
            };
          }
          return story;
        })
      }));
    } else if (type === 'subtask' && taskId && subtaskId) {
      setConfiguration(prev => ({
        ...prev,
        predefined_stories: prev.predefined_stories.map(story => {
          if ((story as any).id === storyId) {
            return {
              ...story,
              predefined_tasks: story.predefined_tasks.map(task => {
                if ((task as any).id === taskId) {
                  return {
                    ...task,
                    predefined_subtasks: task.predefined_subtasks.filter(subtask => (subtask as any).id !== subtaskId)
                  };
                }
                return task;
              })
            };
          }
          return story;
        })
      }));
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverItem(targetId);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetType: string, targetId?: string) => {
    e.preventDefault();
    
    if (!draggedItem) return;

    // Implement reordering logic here
    console.log('Drop:', { draggedItem, targetType, targetId });
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const moveStory = (fromIndex: number, toIndex: number) => {
    setConfiguration(prev => {
      const stories = [...prev.predefined_stories];
      const [moved] = stories.splice(fromIndex, 1);
      stories.splice(toIndex, 0, moved);
      return { ...prev, predefined_stories: stories };
    });
  };

  const calculateTotalHours = (): number => {
    return configuration.predefined_stories.reduce((total, story) => {
      let storyHours = story.estimated_hours || 0;
      
      story.predefined_tasks.forEach(task => {
        storyHours += task.estimated_hours || 0;
        
        task.predefined_subtasks.forEach(subtask => {
          storyHours += subtask.estimated_hours || 0;
        });
      });
      
      return total + storyHours;
    }, 0);
  };

  const getPhasesByUsage = () => {
    const phaseUsage = new Map();
    
    configuration.predefined_stories.forEach(story => {
      const count = phaseUsage.get(story.phase_id) || 0;
      phaseUsage.set(story.phase_id, count + 1);
    });
    
    return Array.from(phaseUsage.entries()).map(([phaseId, count]) => ({
      phase: phases.find(p => p.id === phaseId),
      count
    }));
  };

  const handleSave = () => {
    // Clean up IDs before saving
    const cleanConfiguration = {
      ...configuration,
      predefined_stories: configuration.predefined_stories.map(story => {
        const { id, ...cleanStory } = story as any;
        return {
          ...cleanStory,
          predefined_tasks: story.predefined_tasks.map(task => {
            const { id, ...cleanTask } = task as any;
            return {
              ...cleanTask,
              predefined_subtasks: task.predefined_subtasks.map(subtask => {
                const { id, ...cleanSubtask } = subtask as any;
                return cleanSubtask;
              })
            };
          })
        };
      })
    };
    
    onSave(cleanConfiguration);
  };

  return (
    <div className="template-editor">
      {/* Header */}
      <div className="template-editor-header">
        <div className="header-info">
          <h2>Template Editor</h2>
          <div className="template-stats">
            <span className="stat">
              {configuration.predefined_stories.length} Stories
            </span>
            <span className="stat">
              {configuration.predefined_stories.reduce((sum, s) => sum + s.predefined_tasks.length, 0)} Tasks
            </span>
            <span className="stat">
              {calculateTotalHours()}h Estimated
            </span>
          </div>
        </div>

        <div className="header-actions">
          {!readOnly && (
            <>
              <button className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Save Template
              </button>
            </>
          )}
        </div>
      </div>

      <div className="template-editor-content">
        {/* Sidebar */}
        <div className="template-sidebar">
          <div className="sidebar-section">
            <h3>Template Settings</h3>
            
            <div className="form-group">
              <label>Default Phases</label>
              <div className="phase-checkboxes">
                {phases.map(phase => (
                  <label key={phase.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={configuration.default_phases.includes(phase.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfiguration(prev => ({
                            ...prev,
                            default_phases: [...prev.default_phases, phase.id]
                          }));
                        } else {
                          setConfiguration(prev => ({
                            ...prev,
                            default_phases: prev.default_phases.filter(id => id !== phase.id)
                          }));
                        }
                      }}
                      disabled={readOnly}
                    />
                    {phase.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Phase Filter</label>
              <select 
                value={selectedPhase || ''} 
                onChange={(e) => setSelectedPhase(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">All Phases</option>
                {phases.map(phase => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Phase Distribution</h3>
            <div className="phase-distribution">
              {getPhasesByUsage().map(({ phase, count }) => (
                <div key={phase?.id} className="phase-stat">
                  <span className="phase-name">{phase?.name}</span>
                  <span className="phase-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="template-main">
          <div className="template-structure">
            <div className="structure-header">
              <h3>Template Structure</h3>
              {!readOnly && (
                <button className="btn btn-primary" onClick={addStory}>
                  Add Story
                </button>
              )}
            </div>

            <div className="stories-list">
              {configuration.predefined_stories.length === 0 ? (
                <div className="empty-template">
                  <p>No stories defined yet.</p>
                  {!readOnly && (
                    <button className="btn btn-primary" onClick={addStory}>
                      Add First Story
                    </button>
                  )}
                </div>
              ) : (
                configuration.predefined_stories
                  .filter(story => !selectedPhase || story.phase_id === selectedPhase)
                  .map((story, storyIndex) => {
                    const storyId = (story as any).id || generateId();
                    const isExpanded = expandedItems.has(storyId);

                    return (
                      <div
                        key={storyId}
                        className={`story-template-item ${dragOverItem === storyId ? 'drag-over' : ''}`}
                        draggable={!readOnly}
                        onDragStart={(e) => handleDragStart(e, {
                          type: 'story',
                          id: storyId,
                          data: story,
                          sourceIndex: storyIndex
                        })}
                        onDragOver={(e) => handleDragOver(e, storyId)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, 'story', storyId)}
                      >
                        {/* Story Header */}
                        <div className="template-item-header">
                          <div className="item-expand">
                            <button
                              className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => toggleExpansion(storyId)}
                            >
                              {story.predefined_tasks.length > 0 ? (isExpanded ? '▼' : '▶') : '—'}
                            </button>
                            <span className="item-type">Story</span>
                          </div>

                          <div className="item-content">
                            {readOnly ? (
                              <h4 className="item-title">{story.title}</h4>
                            ) : (
                              <input
                                type="text"
                                className="item-title-input"
                                value={story.title}
                                onChange={(e) => updateStory(storyId, { title: e.target.value })}
                                placeholder="Story title"
                              />
                            )}

                            <div className="item-meta">
                              <select
                                value={story.phase_id}
                                onChange={(e) => updateStory(storyId, { phase_id: parseInt(e.target.value) })}
                                disabled={readOnly}
                                className="phase-select"
                              >
                                {phases.map(phase => (
                                  <option key={phase.id} value={phase.id}>
                                    {phase.name}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="number"
                                value={story.estimated_hours || 0}
                                onChange={(e) => updateStory(storyId, { estimated_hours: parseFloat(e.target.value) || 0 })}
                                disabled={readOnly}
                                className="hours-input"
                                placeholder="Hours"
                                min="0"
                                step="0.5"
                              />
                              <span className="hours-label">hours</span>
                            </div>
                          </div>

                          {!readOnly && (
                            <div className="item-actions">
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => addTask(storyId)}
                              >
                                Add Task
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => deleteItem('story', storyId)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Story Description */}
                        {!readOnly && (
                          <div className="item-description">
                            <textarea
                              value={story.description || ''}
                              onChange={(e) => updateStory(storyId, { description: e.target.value })}
                              placeholder="Story description (optional)"
                              rows={2}
                            />
                          </div>
                        )}

                        {/* Tasks */}
                        {isExpanded && story.predefined_tasks.length > 0 && (
                          <div className="tasks-container">
                            {story.predefined_tasks.map((task, taskIndex) => {
                              const taskId = (task as any).id || generateId();
                              const isTaskExpanded = expandedItems.has(taskId);

                              return (
                                <div
                                  key={taskId}
                                  className={`task-template-item ${dragOverItem === taskId ? 'drag-over' : ''}`}
                                  draggable={!readOnly}
                                  onDragStart={(e) => handleDragStart(e, {
                                    type: 'task',
                                    id: taskId,
                                    data: task,
                                    sourceIndex: taskIndex,
                                    sourceParentId: storyId
                                  })}
                                >
                                  <div className="template-item-header">
                                    <div className="item-expand">
                                      <button
                                        className={`expand-btn ${isTaskExpanded ? 'expanded' : ''}`}
                                        onClick={() => toggleExpansion(taskId)}
                                      >
                                        {task.predefined_subtasks.length > 0 ? (isTaskExpanded ? '▼' : '▶') : '—'}
                                      </button>
                                      <span className="item-type">Task</span>
                                    </div>

                                    <div className="item-content">
                                      {readOnly ? (
                                        <h5 className="item-title">{task.title}</h5>
                                      ) : (
                                        <input
                                          type="text"
                                          className="item-title-input"
                                          value={task.title}
                                          onChange={(e) => updateTask(storyId, taskId, { title: e.target.value })}
                                          placeholder="Task title"
                                        />
                                      )}

                                      <div className="item-meta">
                                        <input
                                          type="number"
                                          value={task.estimated_hours || 0}
                                          onChange={(e) => updateTask(storyId, taskId, { estimated_hours: parseFloat(e.target.value) || 0 })}
                                          disabled={readOnly}
                                          className="hours-input"
                                          placeholder="Hours"
                                          min="0"
                                          step="0.5"
                                        />
                                        <span className="hours-label">hours</span>
                                      </div>
                                    </div>

                                    {!readOnly && (
                                      <div className="item-actions">
                                        <button
                                          className="btn btn-xs btn-secondary"
                                          onClick={() => addSubtask(storyId, taskId)}
                                        >
                                          Add Subtask
                                        </button>
                                        <button
                                          className="btn btn-xs btn-danger"
                                          onClick={() => deleteItem('task', storyId, taskId)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Subtasks */}
                                  {isTaskExpanded && task.predefined_subtasks.length > 0 && (
                                    <div className="subtasks-container">
                                      {task.predefined_subtasks.map((subtask, subtaskIndex) => {
                                        const subtaskId = (subtask as any).id || generateId();

                                        return (
                                          <div
                                            key={subtaskId}
                                            className="subtask-template-item"
                                            draggable={!readOnly}
                                          >
                                            <div className="template-item-header">
                                              <div className="item-expand">
                                                <span className="item-type">Subtask</span>
                                              </div>

                                              <div className="item-content">
                                                {readOnly ? (
                                                  <span className="item-title">{subtask.title}</span>
                                                ) : (
                                                  <input
                                                    type="text"
                                                    className="item-title-input"
                                                    value={subtask.title}
                                                    onChange={(e) => updateSubtask(storyId, taskId, subtaskId, { title: e.target.value })}
                                                    placeholder="Subtask title"
                                                  />
                                                )}

                                                <div className="item-meta">
                                                  <input
                                                    type="number"
                                                    value={subtask.estimated_hours || 0}
                                                    onChange={(e) => updateSubtask(storyId, taskId, subtaskId, { estimated_hours: parseFloat(e.target.value) || 0 })}
                                                    disabled={readOnly}
                                                    className="hours-input"
                                                    placeholder="Hours"
                                                    min="0"
                                                    step="0.5"
                                                  />
                                                  <span className="hours-label">hours</span>
                                                </div>
                                              </div>

                                              {!readOnly && (
                                                <div className="item-actions">
                                                  <button
                                                    className="btn btn-xs btn-danger"
                                                    onClick={() => deleteItem('subtask', storyId, taskId, subtaskId)}
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;