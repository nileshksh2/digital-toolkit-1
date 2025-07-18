import React, { useState, useEffect } from 'react';
import { Epic, Story, Task, Subtask, Status, Priority } from '../../shared/types';
import './HierarchicalTaskView.css';

interface HierarchicalTaskViewProps {
  epic: Epic;
  stories: Array<Story & {
    tasks: Array<Task & {
      subtasks: Subtask[];
    }>;
  }>;
  onStoryUpdate?: (storyId: number, updates: Partial<Story>) => void;
  onTaskUpdate?: (taskId: number, updates: Partial<Task>) => void;
  onSubtaskUpdate?: (subtaskId: number, updates: Partial<Subtask>) => void;
  onCreateStory?: () => void;
  onCreateTask?: (storyId: number) => void;
  onCreateSubtask?: (taskId: number) => void;
  editable?: boolean;
  showDetails?: boolean;
}

export const HierarchicalTaskView: React.FC<HierarchicalTaskViewProps> = ({
  epic,
  stories,
  onStoryUpdate,
  onTaskUpdate,
  onSubtaskUpdate,
  onCreateStory,
  onCreateTask,
  onCreateSubtask,
  editable = false,
  showDetails = true
}) => {
  const [expandedStories, setExpandedStories] = useState<Set<number>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const toggleStoryExpansion = (storyId: number) => {
    const newExpanded = new Set(expandedStories);
    if (newExpanded.has(storyId)) {
      newExpanded.delete(storyId);
    } else {
      newExpanded.add(storyId);
    }
    setExpandedStories(newExpanded);
  };

  const toggleTaskExpansion = (taskId: number) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getStatusIcon = (status: Status): string => {
    switch (status) {
      case Status.NOT_STARTED: return '○';
      case Status.IN_PROGRESS: return '◐';
      case Status.COMPLETED: return '●';
      case Status.BLOCKED: return '⚠';
      default: return '○';
    }
  };

  const getStatusClass = (status: Status): string => {
    return `status-${status.replace('_', '-')}`;
  };

  const getPriorityClass = (priority: Priority): string => {
    return `priority-${priority}`;
  };

  const calculateProgress = (items: Array<{ completion_percentage?: number; status?: Status }>): number => {
    if (items.length === 0) return 0;
    const totalProgress = items.reduce((sum, item) => {
      return sum + (item.completion_percentage || (item.status === Status.COMPLETED ? 100 : 0));
    }, 0);
    return Math.round(totalProgress / items.length);
  };

  const getItemCounts = (items: Array<{ status: Status }>) => {
    return {
      total: items.length,
      completed: items.filter(item => item.status === Status.COMPLETED).length,
      inProgress: items.filter(item => item.status === Status.IN_PROGRESS).length,
      notStarted: items.filter(item => item.status === Status.NOT_STARTED).length,
      blocked: items.filter(item => item.status === Status.BLOCKED).length
    };
  };

  const handleItemSelection = (itemType: string, itemId: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      const itemKey = `${itemType}-${itemId}`;
      const newSelected = new Set(selectedItems);
      if (newSelected.has(itemKey)) {
        newSelected.delete(itemKey);
      } else {
        newSelected.add(itemKey);
      }
      setSelectedItems(newSelected);
    }
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  };

  const epicProgress = calculateProgress(stories);
  const epicCounts = getItemCounts(stories);

  return (
    <div className="hierarchical-task-view">
      {/* Epic Header */}
      <div className="epic-header">
        <div className="epic-title-section">
          <h2 className="epic-title">{epic.title}</h2>
          <div className="epic-meta">
            <span className={`status-badge ${getStatusClass(epic.status)}`}>
              {epic.status.replace('_', ' ').toUpperCase()}
            </span>
            <span className={`priority-badge ${getPriorityClass(epic.priority)}`}>
              {epic.priority.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="epic-progress">
          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${epicProgress}%` }}
              />
            </div>
            <span className="progress-text">{epicProgress}%</span>
          </div>
          
          <div className="epic-stats">
            <span className="stat">
              <span className="stat-number">{epicCounts.total}</span>
              <span className="stat-label">Stories</span>
            </span>
            <span className="stat">
              <span className="stat-number">{epicCounts.completed}</span>
              <span className="stat-label">Done</span>
            </span>
            <span className="stat">
              <span className="stat-number">{epicCounts.inProgress}</span>
              <span className="stat-label">In Progress</span>
            </span>
          </div>
        </div>

        {editable && (
          <div className="epic-actions">
            <button 
              className="btn btn-primary"
              onClick={onCreateStory}
            >
              Add Story
            </button>
          </div>
        )}
      </div>

      {epic.description && (
        <div className="epic-description">
          <p>{epic.description}</p>
        </div>
      )}

      {/* Stories List */}
      <div className="stories-container">
        {stories.length === 0 ? (
          <div className="empty-state">
            <p>No stories found for this epic.</p>
            {editable && (
              <button 
                className="btn btn-primary"
                onClick={onCreateStory}
              >
                Create First Story
              </button>
            )}
          </div>
        ) : (
          stories.map((story, storyIndex) => {
            const storyProgress = calculateProgress(story.tasks);
            const taskCounts = getItemCounts(story.tasks);
            const isExpanded = expandedStories.has(story.id);
            const isSelected = selectedItems.has(`story-${story.id}`);

            return (
              <div 
                key={story.id} 
                className={`story-item ${isSelected ? 'selected' : ''}`}
              >
                {/* Story Header */}
                <div 
                  className="story-header"
                  onClick={(e) => handleItemSelection('story', story.id, e)}
                >
                  <div className="story-expand-section">
                    <button
                      className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStoryExpansion(story.id);
                      }}
                    >
                      {story.tasks.length > 0 ? (isExpanded ? '▼' : '▶') : '—'}
                    </button>
                    <span className={`status-icon ${getStatusClass(story.status)}`}>
                      {getStatusIcon(story.status)}
                    </span>
                  </div>

                  <div className="story-content">
                    <div className="story-title-section">
                      <h4 className="story-title">{story.title}</h4>
                      <div className="story-badges">
                        <span className={`priority-badge ${getPriorityClass(story.priority)}`}>
                          {story.priority}
                        </span>
                        {story.assignee_first_name && (
                          <span className="assignee-badge">
                            {story.assignee_first_name} {story.assignee_last_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {showDetails && (
                      <div className="story-details">
                        <div className="story-progress">
                          <div className="progress-bar small">
                            <div 
                              className="progress-fill"
                              style={{ width: `${storyProgress}%` }}
                            />
                          </div>
                          <span className="progress-text">{storyProgress}%</span>
                        </div>

                        <div className="story-meta">
                          {story.due_date && (
                            <span className="due-date">
                              Due: {formatDate(story.due_date)}
                            </span>
                          )}
                          <span className="task-count">
                            {taskCounts.completed}/{taskCounts.total} tasks
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {editable && (
                    <div className="story-actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateTask?.(story.id);
                        }}
                      >
                        Add Task
                      </button>
                    </div>
                  )}
                </div>

                {/* Tasks List */}
                {isExpanded && (
                  <div className="tasks-container">
                    {story.tasks.length === 0 ? (
                      <div className="empty-tasks">
                        <p>No tasks in this story.</p>
                        {editable && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onCreateTask?.(story.id)}
                          >
                            Add First Task
                          </button>
                        )}
                      </div>
                    ) : (
                      story.tasks.map((task, taskIndex) => {
                        const subtaskCounts = getItemCounts(task.subtasks);
                        const isTaskExpanded = expandedTasks.has(task.id);
                        const isTaskSelected = selectedItems.has(`task-${task.id}`);

                        return (
                          <div 
                            key={task.id}
                            className={`task-item ${isTaskSelected ? 'selected' : ''}`}
                          >
                            {/* Task Header */}
                            <div 
                              className="task-header"
                              onClick={(e) => handleItemSelection('task', task.id, e)}
                            >
                              <div className="task-expand-section">
                                <button
                                  className={`expand-btn ${isTaskExpanded ? 'expanded' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskExpansion(task.id);
                                  }}
                                >
                                  {task.subtasks.length > 0 ? (isTaskExpanded ? '▼' : '▶') : '—'}
                                </button>
                                <span className={`status-icon ${getStatusClass(task.status)}`}>
                                  {getStatusIcon(task.status)}
                                </span>
                              </div>

                              <div className="task-content">
                                <div className="task-title-section">
                                  <h5 className="task-title">{task.title}</h5>
                                  <div className="task-badges">
                                    <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                                      {task.priority}
                                    </span>
                                    {task.assignee_first_name && (
                                      <span className="assignee-badge">
                                        {task.assignee_first_name} {task.assignee_last_name}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {showDetails && (
                                  <div className="task-details">
                                    <div className="task-progress">
                                      <div className="progress-bar small">
                                        <div 
                                          className="progress-fill"
                                          style={{ width: `${task.completion_percentage || 0}%` }}
                                        />
                                      </div>
                                      <span className="progress-text">{task.completion_percentage || 0}%</span>
                                    </div>

                                    <div className="task-meta">
                                      {task.due_date && (
                                        <span className="due-date">
                                          Due: {formatDate(task.due_date)}
                                        </span>
                                      )}
                                      <span className="subtask-count">
                                        {subtaskCounts.completed}/{subtaskCounts.total} subtasks
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {editable && (
                                <div className="task-actions">
                                  <button
                                    className="btn btn-xs btn-secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCreateSubtask?.(task.id);
                                    }}
                                  >
                                    Add Subtask
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Subtasks List */}
                            {isTaskExpanded && (
                              <div className="subtasks-container">
                                {task.subtasks.length === 0 ? (
                                  <div className="empty-subtasks">
                                    <p>No subtasks in this task.</p>
                                    {editable && (
                                      <button
                                        className="btn btn-xs btn-primary"
                                        onClick={() => onCreateSubtask?.(task.id)}
                                      >
                                        Add First Subtask
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  task.subtasks.map((subtask, subtaskIndex) => {
                                    const isSubtaskSelected = selectedItems.has(`subtask-${subtask.id}`);

                                    return (
                                      <div 
                                        key={subtask.id}
                                        className={`subtask-item ${isSubtaskSelected ? 'selected' : ''}`}
                                        onClick={(e) => handleItemSelection('subtask', subtask.id, e)}
                                      >
                                        <div className="subtask-header">
                                          <span className={`status-icon ${getStatusClass(subtask.status)}`}>
                                            {getStatusIcon(subtask.status)}
                                          </span>
                                          <span className="subtask-title">{subtask.title}</span>
                                          <div className="subtask-badges">
                                            <span className={`priority-badge ${getPriorityClass(subtask.priority)}`}>
                                              {subtask.priority}
                                            </span>
                                            {subtask.assignee_first_name && (
                                              <span className="assignee-badge">
                                                {subtask.assignee_first_name} {subtask.assignee_last_name}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {showDetails && subtask.due_date && (
                                          <div className="subtask-meta">
                                            <span className="due-date">
                                              Due: {formatDate(subtask.due_date)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Selection Actions */}
      {selectedItems.size > 0 && editable && (
        <div className="selection-actions">
          <div className="selection-info">
            {selectedItems.size} item(s) selected
          </div>
          <div className="bulk-actions">
            <button className="btn btn-sm btn-secondary">
              Bulk Edit
            </button>
            <button className="btn btn-sm btn-secondary">
              Change Status
            </button>
            <button className="btn btn-sm btn-secondary">
              Assign
            </button>
            <button 
              className="btn btn-sm btn-secondary"
              onClick={() => setSelectedItems(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HierarchicalTaskView;