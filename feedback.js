import React, { useState, useEffect } from 'react';

// Environment-aware API Configuration
// This detection ONLY affects pbod environment - production remains unchanged
const getFeedbackApiUrl = () => {
  const hostname = window.location.hostname;

  // ONLY change behavior for pbod environment
  if (hostname === 'pbod.seibtribe.us' || hostname.includes('pbod')) {
    // Using the dedicated pbod environment API
    return 'https://3unsrrsapf.execute-api.us-east-1.amazonaws.com/pbod/feedback';
  }

  // DEFAULT: Always use production for any other domain
  // This ensures board.seibtribe.us and all other domains continue working exactly as before
  return 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production/feedback';
};

// Lambda API configuration - now environment-aware
const LAMBDA_API_URL = getFeedbackApiUrl();

export function FeedbackButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [issueType, setIssueType] = useState('');

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleOptionClick = (type) => {
    setIssueType(type);
    setShowForm(true);
    setIsMenuOpen(false);
  };

  return (
    <>
      <div className="feedback-fab-container">
        <div className="feedback-fab-tooltip-container">
          <button
            className={`feedback-fab ${isMenuOpen ? 'active' : ''}`}
            onClick={handleMenuToggle}
          >
            {isMenuOpen ? '×' : '💬'}
          </button>
          <div className="feedback-fab-tooltip">Submit Feedback</div>
        </div>
        
        {isMenuOpen && (
          <div className="feedback-menu">
            <button
              className="feedback-option"
              onClick={() => handleOptionClick('bug')}
              title="Report a Bug"
            >
              🐛 Bug Report
            </button>
            <button
              className="feedback-option"
              onClick={() => handleOptionClick('feature')}
              title="Request a Feature"
            >
              💡 Feature Request
            </button>
            <button
              className="feedback-option"
              onClick={() => handleOptionClick('feedback')}
              title="General Feedback"
            >
              💭 Feedback
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <FeedbackForm
          type={issueType}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}

export function FeedbackForm({ type, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Reset form when opened
    setTitle('');
    setDescription('');
    setEmail('');
    setAdditionalInfo('');
    setMessage('');
    setIsSuccess(false);
  }, [type]);

  const getTypeEmoji = () => {
    switch(type) {
      case 'bug': return '🐛';
      case 'feature': return '💡';
      case 'feedback': return '💭';
      default: return '📝';
    }
  };

  const getTypeLabel = () => {
    switch(type) {
      case 'bug': return 'Bug Report';
      case 'feature': return 'Feature Request';
      case 'feedback': return 'General Feedback';
      default: return 'Feedback';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      // Map form types to Lambda expected types
      const issueTypeMap = {
        'bug': 'bug',
        'feature': 'feature',
        'feedback': 'help'
      };

      // Prepare the request body for Lambda
      const requestBody = {
        title,
        description,
        issueType: issueTypeMap[type] || 'help',
        context: 'user', // Personal Board context
        userAgent: navigator.userAgent,
        url: window.location.href,
        additionalInfo: email ? `Contact Email: ${email}${additionalInfo ? '\n\nAdditional Info: ' + additionalInfo : ''}` : additionalInfo || undefined
      };

      // Submit to Lambda API - use text/plain to avoid preflight
      const response = await fetch(LAMBDA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        setIsSuccess(true);
        setMessage(`Thank you! Your ${getTypeLabel().toLowerCase()} has been submitted successfully. Issue #${result.issueNumber}`);
        
        // Auto-close after success
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setMessage('Sorry, there was an error submitting your feedback. Please try again later.');
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  return (
    <div className="feedback-modal" onClick={handleOverlayClick}>
      <div className="feedback-modal-content">
        <div className="feedback-header">
          <h2>{getTypeEmoji()} {getTypeLabel()}</h2>
          <button 
            className="feedback-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        {message && (
          <div className={`feedback-message ${isSuccess ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {!isSuccess && (
          <form onSubmit={handleSubmit}>
            <div className="feedback-field">
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Brief summary of your ${type}`}
                maxLength={100}
                required
                disabled={isSubmitting}
              />
              <span className="char-count">{title.length}/100</span>
            </div>

            <div className="feedback-field">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Please describe your ${type} in detail...`}
                maxLength={1000}
                rows={6}
                required
                disabled={isSubmitting}
              />
              <span className="char-count">{description.length}/1000</span>
            </div>

            <div className="feedback-field">
              <label htmlFor="email">Email (optional)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com (if you'd like a response)"
                disabled={isSubmitting}
              />
            </div>

            <div className="feedback-field">
              <label htmlFor="additionalInfo">Additional Information (optional)</label>
              <textarea
                id="additionalInfo"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Any additional context or details..."
                maxLength={500}
                rows={3}
                disabled={isSubmitting}
              />
              <span className="char-count">{additionalInfo.length}/500</span>
            </div>

            <div className="feedback-actions">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="feedback-cancel"
                title="Cancel and close feedback form"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !description.trim()}
                className="feedback-submit"
                title="Submit your feedback as a GitHub issue"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}