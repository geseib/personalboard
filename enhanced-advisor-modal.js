/**
 * Enhanced Advisor Modal for Personal Board of Directors
 * Provides intelligent, context-aware guidance with enhanced UI components
 */

/**
 * Create and show enhanced advisor modal with intelligent insights
 * @param {Object} guidance - AI guidance response
 * @param {Object} userContext - Current user data and context
 * @param {string} formType - Type of form/advisor (skills, goals, mentors, etc.)
 */
function showEnhancedAdvisorModal(guidance, userContext, formType) {
    // Get intelligent insights
    const insights = window.AdvisorIntelligence.getIntelligentInsights(userContext);

    // Parse enhanced guidance (if available)
    const parsedGuidance = parseEnhancedGuidance(guidance);

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'enhanced-advisor-modal-overlay';
    modal.innerHTML = createEnhancedModalHTML(parsedGuidance, insights, formType);

    // Add modal to DOM
    document.body.appendChild(modal);

    // Add event listeners
    setupEnhancedModalEventListeners(modal, userContext, formType);

    // Animate in
    setTimeout(() => modal.classList.add('show'), 10);

    return modal;
}

/**
 * Parse enhanced guidance response for structured content
 * @param {string} guidance - Raw AI guidance text
 * @returns {Object} Parsed guidance object
 */
function parseEnhancedGuidance(guidance) {
    const parsed = {
        insights: { priority: [], opportunities: [], warnings: [] },
        recommendations: [],
        conversationStarters: [],
        networkingOps: [],
        isEnhanced: false
    };

    if (!guidance) return parsed;

    // Check if this is enhanced mode guidance
    parsed.isEnhanced = guidance.includes('## Strategic Insights') ||
                       guidance.includes('### Priority Development Areas') ||
                       guidance.includes('### Immediate Actions');

    if (parsed.isEnhanced) {
        // Parse enhanced guidance sections
        parsed.insights = parseInsights(guidance);
        parsed.recommendations = parseRecommendations(guidance);
        parsed.conversationStarters = parseConversationStarters(guidance);
        parsed.networkingOps = parseNetworkingOpportunities(guidance);
    } else {
        // Parse standard guidance
        parsed.recommendations = guidance.split('\n').filter(line =>
            line.trim() && !line.startsWith('#')
        ).map(line => ({
            text: line.trim(),
            urgency: 'medium',
            actionable: true
        }));
    }

    return parsed;
}

/**
 * Parse insights from enhanced guidance
 * @param {string} guidance - AI guidance text
 * @returns {Object} Parsed insights
 */
function parseInsights(guidance) {
    const insights = { priority: [], opportunities: [], warnings: [] };

    // Extract priority insights
    const priorityMatch = guidance.match(/### Priority Development Areas([\s\S]*?)(?=###|$)/);
    if (priorityMatch) {
        insights.priority = priorityMatch[1]
            .split('\n')
            .filter(line => line.trim().startsWith('1.') || line.trim().startsWith('2.') || line.trim().startsWith('3.'))
            .map(line => line.replace(/^\d+\.\s*/, '').trim());
    }

    // Extract opportunities
    const opportunityMatch = guidance.match(/leverage|opportunity|unlock/gi);
    if (opportunityMatch) {
        insights.opportunities = guidance
            .split('\n')
            .filter(line => /leverage|opportunity|unlock/i.test(line))
            .slice(0, 3);
    }

    return insights;
}

/**
 * Parse recommendations from guidance
 * @param {string} guidance - AI guidance text
 * @returns {Array} Parsed recommendations
 */
function parseRecommendations(guidance) {
    const recommendations = [];

    // Extract immediate actions
    const actionsMatch = guidance.match(/### Immediate Actions[\s\S]*?(?=###|$)/);
    if (actionsMatch) {
        const actions = actionsMatch[0]
            .split('\n')
            .filter(line => line.trim().startsWith('1.') || line.trim().startsWith('2.') || line.trim().startsWith('3.'))
            .map(line => ({
                text: line.replace(/^\d+\.\s*/, '').trim(),
                urgency: 'high',
                actionable: true,
                suggestedField: determineSuggestedField(line)
            }));
        recommendations.push(...actions);
    }

    return recommendations;
}

/**
 * Parse conversation starters from guidance
 * @param {string} guidance - AI guidance text
 * @returns {Array} Conversation starters
 */
function parseConversationStarters(guidance) {
    const starters = [];

    const startersMatch = guidance.match(/### Conversation Starters[\s\S]*?(?=###|$)/);
    if (startersMatch) {
        const lines = startersMatch[0].split('\n').filter(line =>
            line.trim().startsWith('1.') || line.trim().startsWith('2.') || line.trim().startsWith('3.')
        );

        lines.forEach(line => {
            const parts = line.split(' - ');
            if (parts.length >= 2) {
                starters.push({
                    opener: parts[0].replace(/^\d+\.\s*/, '').trim(),
                    purpose: parts[1].trim()
                });
            }
        });
    }

    return starters;
}

/**
 * Parse networking opportunities from guidance
 * @param {string} guidance - AI guidance text
 * @returns {Array} Networking opportunities
 */
function parseNetworkingOpportunities(guidance) {
    // Simple extraction of networking-related suggestions
    return guidance.split('\n')
        .filter(line => /network|connection|introduction|meet/i.test(line))
        .slice(0, 3)
        .map(line => ({ text: line.trim(), type: 'networking' }));
}

/**
 * Determine suggested field for smart "Add to Field" buttons
 * @param {string} recommendation - Recommendation text
 * @returns {string} Suggested field name
 */
function determineSuggestedField(recommendation) {
    const text = recommendation.toLowerCase();

    if (text.includes('skill') || text.includes('superpower')) return 'skills';
    if (text.includes('goal') || text.includes('objective')) return 'goals';
    if (text.includes('mentor') || text.includes('guidance')) return 'mentors';
    if (text.includes('coach') || text.includes('coaching')) return 'coaches';
    if (text.includes('sponsor') || text.includes('sponsorship')) return 'sponsors';
    if (text.includes('connector') || text.includes('network')) return 'connectors';
    if (text.includes('peer') || text.includes('colleague')) return 'peers';

    return 'notes';
}

/**
 * Create HTML for enhanced modal
 * @param {Object} parsedGuidance - Parsed guidance object
 * @param {Object} insights - Intelligent insights
 * @param {string} formType - Form type
 * @returns {string} HTML string
 */
function createEnhancedModalHTML(parsedGuidance, insights, formType) {
    return `
        <div class="enhanced-advisor-modal">
            <div class="enhanced-modal-header">
                <h2>
                    <span class="advisor-icon">🎯</span>
                    Enhanced ${formType.charAt(0).toUpperCase() + formType.slice(1)} Advisor
                </h2>
                <div class="progress-indicator">
                    <span class="completion-score">${Math.round(insights.completionScores.overall * 100)}% Complete</span>
                    <span class="journey-stage">${insights.journeyStage} Stage</span>
                </div>
                <button class="enhanced-modal-close" onclick="this.closest('.enhanced-advisor-modal-overlay').remove()">×</button>
            </div>

            <div class="enhanced-modal-body">
                ${createProgressFlow(insights.completionScores)}

                ${insights.insights.urgentActions.length > 0 ?
                    createUrgentActionsSection(insights.insights.urgentActions) : ''}

                ${createStrategicInsightsSection(parsedGuidance.insights, insights)}

                ${createActionableRecommendationsSection(parsedGuidance.recommendations)}

                ${parsedGuidance.conversationStarters.length > 0 ?
                    createConversationToolsSection(parsedGuidance.conversationStarters, parsedGuidance.networkingOps) : ''}

                ${createNextStepsSection(insights.insights.nextSteps)}
            </div>

            <div class="enhanced-modal-footer">
                <button class="enhanced-btn enhanced-btn-secondary" onclick="this.closest('.enhanced-advisor-modal-overlay').remove()">
                    Close
                </button>
                <button class="enhanced-btn enhanced-btn-primary" onclick="enableEnhancedMode()">
                    Enable Enhanced Mode
                </button>
            </div>
        </div>
    `;
}

/**
 * Create progress flow visualization
 * @param {Object} completionScores - Completion scores
 * @returns {string} HTML for progress flow
 */
function createProgressFlow(completionScores) {
    const sections = [
        { key: 'skills', label: 'Skills', icon: '💪' },
        { key: 'goals', label: 'Goals', icon: '🎯' },
        { key: 'mentors', label: 'Mentors', icon: '👨‍🏫' },
        { key: 'coaches', label: 'Coaches', icon: '🏃‍♂️' },
        { key: 'sponsors', label: 'Sponsors', icon: '🚀' },
        { key: 'connectors', label: 'Connectors', icon: '🔗' },
        { key: 'peers', label: 'Peers', icon: '🤝' }
    ];

    const progressHTML = sections.map(section => {
        const score = completionScores[section.key] || 0;
        const percentage = Math.round(score * 100);
        const status = score > 0.7 ? 'complete' : score > 0.3 ? 'partial' : 'empty';

        return `
            <div class="progress-item ${status}">
                <div class="progress-icon">${section.icon}</div>
                <div class="progress-label">${section.label}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-score">${percentage}%</div>
            </div>
        `;
    }).join('');

    return `
        <section class="progress-flow">
            <h3>Your Board Development Progress</h3>
            <div class="progress-grid">
                ${progressHTML}
            </div>
        </section>
    `;
}

/**
 * Create urgent actions section
 * @param {Array} urgentActions - Urgent actions
 * @returns {string} HTML for urgent actions
 */
function createUrgentActionsSection(urgentActions) {
    const actionsHTML = urgentActions.map(action => `
        <div class="urgent-action-item">
            <span class="urgent-icon">⚡</span>
            <span class="urgent-text">${action}</span>
        </div>
    `).join('');

    return `
        <section class="urgent-actions">
            <h3><span class="urgent-indicator">🚨</span> Immediate Actions Required</h3>
            <div class="urgent-actions-list">
                ${actionsHTML}
            </div>
        </section>
    `;
}

/**
 * Create strategic insights section
 * @param {Object} insights - Parsed insights
 * @param {Object} context - Full context
 * @returns {string} HTML for strategic insights
 */
function createStrategicInsightsSection(insights, context) {
    const priorityHTML = insights.priority.map(item => `
        <div class="insight-card priority">
            <div class="insight-icon">🎯</div>
            <div class="insight-content">${item}</div>
        </div>
    `).join('');

    return `
        <section class="strategic-insights">
            <h3>Strategic Insights</h3>
            <div class="insights-grid">
                ${priorityHTML}
                <div class="insight-card alignment">
                    <div class="insight-icon">⚖️</div>
                    <div class="insight-content">
                        Skill-Goal Alignment: ${Math.round(context.alignment.alignmentScore * 100)}%
                    </div>
                </div>
            </div>
        </section>
    `;
}

/**
 * Create actionable recommendations section
 * @param {Array} recommendations - Recommendations
 * @returns {string} HTML for recommendations
 */
function createActionableRecommendationsSection(recommendations) {
    const recommendationsHTML = recommendations.map((rec, index) => `
        <div class="action-card ${rec.urgency}" data-field="${rec.suggestedField}">
            <div class="action-content">
                <div class="action-text">${rec.text}</div>
                <div class="action-meta">
                    <span class="urgency-badge ${rec.urgency}">${rec.urgency}</span>
                    ${rec.suggestedField ? `<span class="field-hint">→ ${rec.suggestedField}</span>` : ''}
                </div>
            </div>
            <button class="smart-add-button" onclick="smartAddToField('${rec.suggestedField}', '${rec.text.replace(/'/g, '\\\'')}')"
                    data-target-field="${rec.suggestedField}">
                Add to ${rec.suggestedField || 'notes'}
            </button>
        </div>
    `).join('');

    return `
        <section class="actionable-recommendations">
            <h3>Recommended Actions</h3>
            <div class="recommendations-list">
                ${recommendationsHTML}
            </div>
        </section>
    `;
}

/**
 * Create conversation tools section
 * @param {Array} starters - Conversation starters
 * @param {Array} networkingOps - Networking opportunities
 * @returns {string} HTML for conversation tools
 */
function createConversationToolsSection(starters, networkingOps) {
    const startersHTML = starters.map(starter => `
        <div class="conversation-starter">
            <div class="starter-text">"${starter.opener}"</div>
            <div class="starter-purpose">${starter.purpose}</div>
            <button class="copy-starter" onclick="copyToClipboard('${starter.opener.replace(/'/g, '\\\'')}')" title="Copy to clipboard">📋</button>
        </div>
    `).join('');

    return `
        <section class="conversation-tools">
            <h3>Ready-to-Use Conversation Starters</h3>
            <div class="conversation-starters">
                ${startersHTML}
            </div>
        </section>
    `;
}

/**
 * Create next steps section
 * @param {Array} nextSteps - Next steps
 * @returns {string} HTML for next steps
 */
function createNextStepsSection(nextSteps) {
    const stepsHTML = nextSteps.map((step, index) => `
        <div class="next-step">
            <div class="step-number">${index + 1}</div>
            <div class="step-text">${step}</div>
        </div>
    `).join('');

    return `
        <section class="next-steps">
            <h3>Your Next Steps</h3>
            <div class="steps-list">
                ${stepsHTML}
            </div>
        </section>
    `;
}

/**
 * Set up event listeners for enhanced modal
 * @param {Element} modal - Modal element
 * @param {Object} userContext - User context
 * @param {string} formType - Form type
 */
function setupEnhancedModalEventListeners(modal, userContext, formType) {
    // Add hover effects for action cards
    const actionCards = modal.querySelectorAll('.action-card');
    actionCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '';
        });
    });

    // Close modal on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Escape key to close
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

/**
 * Smart add to field functionality
 * @param {string} fieldType - Type of field to add to
 * @param {string} content - Content to add
 */
function smartAddToField(fieldType, content) {
    // This would integrate with the existing form system
    console.log(`Adding to ${fieldType}:`, content);

    // Show success notification
    showNotification(`Added to ${fieldType}!`, 'success');

    // Could trigger form population or modal display here
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy', 'error');
    });
}

/**
 * Show notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * Enable enhanced mode (placeholder)
 */
function enableEnhancedMode() {
    localStorage.setItem('advisorMode', 'enhanced');
    showNotification('Enhanced Mode enabled! Refresh to see enhanced guidance.', 'success');
}

// Export the main function
window.showEnhancedAdvisorModal = showEnhancedAdvisorModal;