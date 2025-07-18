import React, { useState, useEffect } from 'react';
import { Epic, Customer, Story, Comment, RecentActivity, PortalVisibilitySettings, PortalBranding } from '../../shared/types';
import './CustomerPortal.css';

interface CustomerPortalProps {
  portalKey: string;
}

interface PortalData {
  customer: Customer;
  epic: Epic;
  visibility_settings: PortalVisibilitySettings;
  custom_branding?: PortalBranding;
  progress_summary: {
    overall_completion: number;
    phase_progress: Record<number, number>;
    timeline: Array<{
      phase_id: number;
      phase_name: string;
      status: string;
      start_date?: Date;
      end_date?: Date;
      completion_percentage: number;
    }>;
  };
  stories: Story[];
  recent_updates: RecentActivity[];
  customer_comments: Comment[];
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ portalKey }) => {
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'stories' | 'updates' | 'comments'>('overview');
  const [commentForm, setCommentForm] = useState({
    entity_type: 'epic' as 'epic' | 'story' | 'task',
    entity_id: 0,
    content: '',
    author_email: '',
    showForm: false
  });

  useEffect(() => {
    loadPortalData();
  }, [portalKey]);

  const loadPortalData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal/${portalKey}`);
      const result = await response.json();

      if (result.success) {
        setPortalData(result.data);
        setCommentForm(prev => ({ ...prev, entity_id: result.data.epic.id }));
      } else {
        setError(result.message || 'Failed to load portal data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentForm.content.trim() || !commentForm.author_email.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`/api/portal/${portalKey}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_type: commentForm.entity_type,
          entity_id: commentForm.entity_id,
          content: commentForm.content,
          author_email: commentForm.author_email
        })
      });

      const result = await response.json();

      if (result.success) {
        setCommentForm({
          ...commentForm,
          content: '',
          showForm: false
        });
        // Reload portal data to get updated comments
        await loadPortalData();
        alert('Comment submitted successfully!');
      } else {
        alert(result.message || 'Failed to submit comment');
      }
    } catch (err) {
      alert('Failed to submit comment');
    }
  };

  const downloadReport = async (format: 'pdf' | 'excel') => {
    try {
      const response = await fetch(`/api/portal/${portalKey}/report?format=${format}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to generate report');
      }
    } catch (err) {
      alert('Failed to download report');
    }
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'not_started': return '#6b7280';
      case 'blocked': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="customer-portal loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your project dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-portal error">
        <div className="error-message">
          <h2>Unable to Load Portal</h2>
          <p>{error}</p>
          <button onClick={loadPortalData} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!portalData) {
    return null;
  }

  const { customer, epic, visibility_settings, custom_branding, progress_summary } = portalData;

  // Apply custom branding if available
  const portalStyle = custom_branding ? {
    '--primary-color': custom_branding.primary_color || '#3b82f6',
    '--secondary-color': custom_branding.secondary_color || '#1e293b'
  } as React.CSSProperties : {};

  return (
    <div className="customer-portal" style={portalStyle}>
      {/* Header */}
      <header className="portal-header">
        <div className="header-content">
          <div className="project-info">
            {custom_branding?.logo_url && (
              <img src={custom_branding.logo_url} alt="Logo" className="company-logo" />
            )}
            <div>
              <h1>{epic.title}</h1>
              <p className="customer-name">{customer.name}</p>
            </div>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => downloadReport('pdf')} 
              className="btn btn-secondary"
            >
              Download PDF Report
            </button>
            <button 
              onClick={() => downloadReport('excel')} 
              className="btn btn-secondary"
            >
              Download Excel Report
            </button>
          </div>
        </div>

        {/* Project Status Bar */}
        <div className="status-bar">
          <div className="overall-progress">
            <span className="progress-label">Overall Progress</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress_summary.overall_completion}%` }}
              />
            </div>
            <span className="progress-text">{progress_summary.overall_completion}%</span>
          </div>
          <div className="project-status">
            <span 
              className="status-badge"
              style={{ backgroundColor: getStatusColor(epic.status) }}
            >
              {epic.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="portal-nav">
        <button 
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        {visibility_settings.show_timeline && (
          <button 
            className={`nav-tab ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            Progress
          </button>
        )}
        {visibility_settings.show_stories && (
          <button 
            className={`nav-tab ${activeTab === 'stories' ? 'active' : ''}`}
            onClick={() => setActiveTab('stories')}
          >
            Stories
          </button>
        )}
        <button 
          className={`nav-tab ${activeTab === 'updates' ? 'active' : ''}`}
          onClick={() => setActiveTab('updates')}
        >
          Recent Updates
        </button>
        {visibility_settings.show_comments && (
          <button 
            className={`nav-tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            Comments
          </button>
        )}
      </nav>

      {/* Main Content */}
      <main className="portal-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-grid">
              {/* Project Summary */}
              <div className="summary-card">
                <h3>Project Summary</h3>
                <div className="summary-content">
                  <p>{epic.description || 'No description available.'}</p>
                  <div className="project-meta">
                    <div className="meta-item">
                      <span className="meta-label">Start Date:</span>
                      <span>{formatDate(epic.start_date)}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Target End Date:</span>
                      <span>{formatDate(epic.end_date)}</span>
                    </div>
                    {epic.estimated_hours && (
                      <div className="meta-item">
                        <span className="meta-label">Estimated Hours:</span>
                        <span>{epic.estimated_hours}h</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Phase Overview */}
              {visibility_settings.show_phases && (
                <div className="phases-card">
                  <h3>Project Phases</h3>
                  <div className="phases-overview">
                    {progress_summary.timeline.map((phase) => (
                      <div key={phase.phase_id} className="phase-overview-item">
                        <div className="phase-header">
                          <span className="phase-name">{phase.phase_name}</span>
                          <span className="phase-percentage">{phase.completion_percentage}%</span>
                        </div>
                        <div className="phase-progress">
                          <div className="progress-bar small">
                            <div 
                              className="progress-fill"
                              style={{ width: `${phase.completion_percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="phase-dates">
                          {phase.start_date && (
                            <span className="phase-date">Started: {formatDate(phase.start_date)}</span>
                          )}
                          {phase.end_date && (
                            <span className="phase-date">Completed: {formatDate(phase.end_date)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="activity-card">
                <h3>Recent Activity</h3>
                <div className="activity-list">
                  {portalData.recent_updates.slice(0, 5).map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-content">
                        <p>{activity.description}</p>
                        <span className="activity-time">
                          {new Date(activity.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && visibility_settings.show_timeline && (
          <div className="progress-tab">
            <div className="timeline-container">
              <h3>Project Timeline</h3>
              <div className="timeline">
                {progress_summary.timeline.map((phase, index) => (
                  <div key={phase.phase_id} className={`timeline-item ${phase.status}`}>
                    <div className="timeline-marker">
                      <div className="marker-circle">
                        {phase.completion_percentage === 100 ? '✓' : index + 1}
                      </div>
                      {index < progress_summary.timeline.length - 1 && (
                        <div className="timeline-line"></div>
                      )}
                    </div>
                    <div className="timeline-content">
                      <h4>{phase.phase_name}</h4>
                      <div className="timeline-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${phase.completion_percentage}%` }}
                          />
                        </div>
                        <span>{phase.completion_percentage}%</span>
                      </div>
                      <div className="timeline-dates">
                        {phase.start_date && (
                          <span>Started: {formatDate(phase.start_date)}</span>
                        )}
                        {phase.end_date && (
                          <span>Completed: {formatDate(phase.end_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stories Tab */}
        {activeTab === 'stories' && visibility_settings.show_stories && (
          <div className="stories-tab">
            <h3>Project Stories</h3>
            <div className="stories-list">
              {portalData.stories.map((story) => (
                <div key={story.id} className="story-card">
                  <div className="story-header">
                    <h4>{story.title}</h4>
                    <div className="story-meta">
                      <span className="phase-tag">{story.phase_name}</span>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(story.status) }}
                      >
                        {story.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {story.description && (
                    <p className="story-description">{story.description}</p>
                  )}
                  <div className="story-progress">
                    <span>Progress: {story.completion_percentage || 0}%</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${story.completion_percentage || 0}%` }}
                      />
                    </div>
                  </div>
                  {story.due_date && (
                    <div className="story-due-date">
                      Due: {formatDate(story.due_date)}
                    </div>
                  )}
                  {visibility_settings.show_comments && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setCommentForm({
                        ...commentForm,
                        entity_type: 'story',
                        entity_id: story.id,
                        showForm: true
                      })}
                    >
                      Add Comment
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Updates Tab */}
        {activeTab === 'updates' && (
          <div className="updates-tab">
            <h3>Recent Updates</h3>
            <div className="updates-list">
              {portalData.recent_updates.map((update, index) => (
                <div key={index} className="update-item">
                  <div className="update-content">
                    <p>{update.description}</p>
                    <div className="update-meta">
                      <span className="update-user">
                        {update.user.first_name} {update.user.last_name}
                      </span>
                      <span className="update-time">
                        {new Date(update.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && visibility_settings.show_comments && (
          <div className="comments-tab">
            <div className="comments-header">
              <h3>Comments & Feedback</h3>
              <button
                className="btn btn-primary"
                onClick={() => setCommentForm({
                  ...commentForm,
                  entity_type: 'epic',
                  entity_id: epic.id,
                  showForm: true
                })}
              >
                Add Comment
              </button>
            </div>

            {/* Comment Form */}
            {commentForm.showForm && (
              <div className="comment-form">
                <h4>Add Your Comment</h4>
                <div className="form-group">
                  <label>Your Email</label>
                  <input
                    type="email"
                    value={commentForm.author_email}
                    onChange={(e) => setCommentForm({ ...commentForm, author_email: e.target.value })}
                    placeholder="your.email@company.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Comment</label>
                  <textarea
                    value={commentForm.content}
                    onChange={(e) => setCommentForm({ ...commentForm, content: e.target.value })}
                    placeholder="Share your feedback, questions, or updates..."
                    rows={4}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCommentForm({ ...commentForm, showForm: false })}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={submitComment}
                  >
                    Submit Comment
                  </button>
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className="comments-list">
              {portalData.customer_comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <span className="comment-author">{comment.author_email}</span>
                    <span className="comment-time">{formatDate(comment.created_at)}</span>
                  </div>
                  <div className="comment-content">
                    <p>{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerPortal;