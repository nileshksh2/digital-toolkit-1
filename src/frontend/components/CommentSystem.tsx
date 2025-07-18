import React, { useState, useEffect, useRef } from 'react';
import { Comment, CommentThread, EntityType, User } from '../../shared/types';
import './CommentSystem.css';

interface CommentSystemProps {
  entityType: EntityType;
  entityId: number;
  currentUser: User;
  showInternalComments?: boolean;
  allowInternalComments?: boolean;
  onCommentAdded?: (comment: Comment) => void;
}

interface CommentFormData {
  content: string;
  isInternal: boolean;
  parentCommentId?: number;
  attachments: File[];
}

export const CommentSystem: React.FC<CommentSystemProps> = ({
  entityType,
  entityId,
  currentUser,
  showInternalComments = true,
  allowInternalComments = true,
  onCommentAdded
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'internal' | 'customer'>('all');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [commentCounts, setCommentCounts] = useState({
    total: 0,
    internal: 0,
    customer: 0
  });

  const [commentForm, setCommentForm] = useState<CommentFormData>({
    content: '',
    isInternal: false,
    attachments: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadComments();
  }, [entityType, entityId, activeTab]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comments/${entityType}/${entityId}?include_internal=${showInternalComments}&tab=${activeTab}`);
      const result = await response.json();

      if (result.success) {
        setComments(result.data.comments);
        setCommentCounts({
          total: result.data.total,
          internal: result.data.internal_count,
          customer: result.data.customer_count
        });
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (parentCommentId?: number) => {
    if (!commentForm.content.trim()) {
      alert('Please enter a comment');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId.toString());
      formData.append('content', commentForm.content);
      formData.append('is_internal', commentForm.isInternal.toString());
      
      if (parentCommentId) {
        formData.append('parent_comment_id', parentCommentId.toString());
      }

      // Add attachments
      commentForm.attachments.forEach((file, index) => {
        formData.append(`attachments`, file);
      });

      const response = await fetch('/api/comments', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setCommentForm({
          content: '',
          isInternal: false,
          attachments: []
        });
        setReplyingTo(null);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        await loadComments();

        if (onCommentAdded) {
          onCommentAdded(result.data);
        }
      } else {
        alert(result.message || 'Failed to submit comment');
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      alert('Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  const updateComment = async (commentId: number, content: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });

      const result = await response.json();

      if (result.success) {
        setEditingComment(null);
        await loadComments();
      } else {
        alert(result.message || 'Failed to update comment');
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
      alert('Failed to update comment');
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await loadComments();
      } else {
        alert(result.message || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment');
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files) {
      const newFiles = Array.from(files);
      setCommentForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setCommentForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleString();
  };

  const getFilteredComments = () => {
    switch (activeTab) {
      case 'internal':
        return comments.filter(comment => comment.is_internal);
      case 'customer':
        return comments.filter(comment => !comment.is_internal);
      default:
        return comments;
    }
  };

  const canEditComment = (comment: Comment): boolean => {
    return comment.author_id === currentUser.id || 
           ['system_admin', 'project_manager'].includes(currentUser.role);
  };

  const canDeleteComment = (comment: Comment): boolean => {
    return comment.author_id === currentUser.id || 
           ['system_admin', 'project_manager'].includes(currentUser.role);
  };

  const renderCommentForm = (parentCommentId?: number, existingContent?: string, isEdit: boolean = false) => (
    <div className={`comment-form ${parentCommentId ? 'reply-form' : 'main-form'}`}>
      <div className="form-header">
        <div className="user-avatar">
          {currentUser.avatar_url ? (
            <img src={currentUser.avatar_url} alt={`${currentUser.first_name} ${currentUser.last_name}`} />
          ) : (
            <div className="avatar-placeholder">
              {currentUser.first_name?.[0]}{currentUser.last_name?.[0]}
            </div>
          )}
        </div>
        <div className="form-controls">
          {allowInternalComments && currentUser.role !== 'customer' && !isEdit && (
            <div className="comment-type-toggle">
              <label className="toggle-option">
                <input
                  type="radio"
                  name={`comment-type-${parentCommentId || 'main'}`}
                  checked={!commentForm.isInternal}
                  onChange={() => setCommentForm(prev => ({ ...prev, isInternal: false }))}
                />
                <span className="customer-badge">Customer Visible</span>
              </label>
              <label className="toggle-option">
                <input
                  type="radio"
                  name={`comment-type-${parentCommentId || 'main'}`}
                  checked={commentForm.isInternal}
                  onChange={() => setCommentForm(prev => ({ ...prev, isInternal: true }))}
                />
                <span className="internal-badge">Internal Only</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="form-body">
        <textarea
          ref={textareaRef}
          value={isEdit ? existingContent : commentForm.content}
          onChange={(e) => {
            if (isEdit) {
              // Handle edit mode separately
              return;
            }
            setCommentForm(prev => ({ ...prev, content: e.target.value }));
          }}
          placeholder={parentCommentId ? "Write a reply..." : "Add a comment..."}
          className="comment-textarea"
          rows={3}
        />

        {!isEdit && commentForm.attachments.length > 0 && (
          <div className="attachments-preview">
            {commentForm.attachments.map((file, index) => (
              <div key={index} className="attachment-item">
                <span className="file-name">{file.name}</span>
                <button
                  type="button"
                  className="remove-attachment"
                  onClick={() => removeAttachment(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="form-actions">
          <div className="form-actions-left">
            {!isEdit && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="file-input"
                  id={`file-input-${parentCommentId || 'main'}`}
                />
                <label htmlFor={`file-input-${parentCommentId || 'main'}`} className="btn btn-sm btn-secondary">
                  📎 Attach Files
                </label>
              </>
            )}
          </div>

          <div className="form-actions-right">
            {parentCommentId && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => isEdit ? updateComment(editingComment!, textareaRef.current?.value || '') : submitComment(parentCommentId)}
              disabled={submitting}
            >
              {submitting ? 'Posting...' : isEdit ? 'Update' : 'Post Comment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderComment = (comment: Comment, level: number = 0) => (
    <div key={comment.id} className={`comment ${comment.is_internal ? 'internal-comment' : 'customer-comment'} level-${level}`}>
      <div className="comment-header">
        <div className="comment-author">
          <div className="author-avatar">
            {comment.author.avatar_url ? (
              <img src={comment.author.avatar_url} alt={`${comment.author.first_name} ${comment.author.last_name}`} />
            ) : (
              <div className="avatar-placeholder">
                {comment.author.first_name?.[0]}{comment.author.last_name?.[0]}
              </div>
            )}
          </div>
          <div className="author-info">
            <span className="author-name">
              {comment.author.first_name} {comment.author.last_name}
            </span>
            <span className="comment-meta">
              {formatDate(comment.created_at)}
              {comment.is_edited && <span className="edited-indicator">(edited)</span>}
              {comment.is_internal && <span className="internal-indicator">Internal</span>}
            </span>
          </div>
        </div>

        <div className="comment-actions">
          {canEditComment(comment) && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setEditingComment(comment.id)}
            >
              Edit
            </button>
          )}
          {canDeleteComment(comment) && (
            <button
              className="btn btn-sm btn-ghost btn-danger"
              onClick={() => deleteComment(comment.id)}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="comment-content">
        {editingComment === comment.id ? (
          <div className="edit-form">
            <textarea
              defaultValue={comment.content}
              className="comment-textarea"
              rows={3}
              ref={textareaRef}
            />
            <div className="edit-actions">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setEditingComment(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => updateComment(comment.id, textareaRef.current?.value || '')}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="comment-text">{comment.content}</p>
            
            {comment.attachments && comment.attachments.length > 0 && (
              <div className="comment-attachments">
                {comment.attachments.map((attachment, index) => (
                  <div key={index} className="attachment-item">
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                      📎 {attachment.filename}
                    </a>
                  </div>
                ))}
              </div>
            )}

            <div className="comment-footer">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setReplyingTo(comment.id)}
              >
                Reply
              </button>
            </div>
          </>
        )}
      </div>

      {/* Reply Form */}
      {replyingTo === comment.id && renderCommentForm(comment.id)}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => renderComment(reply, level + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="comment-system">
      <div className="comment-system-header">
        <div className="comment-tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Comments ({commentCounts.total})
          </button>
          {showInternalComments && (
            <button
              className={`tab ${activeTab === 'internal' ? 'active' : ''}`}
              onClick={() => setActiveTab('internal')}
            >
              Internal ({commentCounts.internal})
            </button>
          )}
          <button
            className={`tab ${activeTab === 'customer' ? 'active' : ''}`}
            onClick={() => setActiveTab('customer')}
          >
            Customer ({commentCounts.customer})
          </button>
        </div>
      </div>

      <div className="comment-system-body">
        {/* Main Comment Form */}
        {!replyingTo && renderCommentForm()}

        {/* Comments List */}
        <div className="comments-list">
          {loading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading comments...</p>
            </div>
          ) : getFilteredComments().length === 0 ? (
            <div className="empty-state">
              <p>No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            getFilteredComments().map(comment => renderComment(comment))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentSystem;