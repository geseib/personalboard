/**
 * Advisor Intelligence Engine for Personal Board of Directors
 * Provides intelligent context analysis, completion scoring, and enhanced guidance
 */

/**
 * Calculate completion scores for each section of user data
 * @param {Object} userData - Complete user data object
 * @returns {Object} Completion scores for each section (0.0 to 1.0)
 */
function calculateCompletionScores(userData) {
    const scores = {
        skills: calculateSkillsCompleteness(userData.superpowers || []),
        goals: calculateGoalsCompleteness(userData.goals || []),
        mentors: calculateBoardCompleteness(userData.mentors || []),
        coaches: calculateBoardCompleteness(userData.coaches || []),
        sponsors: calculateBoardCompleteness(userData.sponsors || []),
        connectors: calculateBoardCompleteness(userData.connectors || []),
        peers: calculateBoardCompleteness(userData.peers || [])
    };

    // Calculate overall completion
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    scores.overall = totalScore / Object.keys(scores).length;

    return scores;
}

/**
 * Calculate skills completeness based on superpowers data
 * @param {Array} superpowers - Array of superpower objects
 * @returns {number} Completion score (0.0 to 1.0)
 */
function calculateSkillsCompleteness(superpowers) {
    if (!superpowers || superpowers.length === 0) return 0.0;

    let totalFields = 0;
    let completedFields = 0;

    superpowers.forEach(skill => {
        // Check required fields
        totalFields += 3; // name, description, category
        if (skill.name && skill.name.trim()) completedFields++;
        if (skill.description && skill.description.trim()) completedFields++;
        if (skill.category && skill.category.trim()) completedFields++;

        // Bonus for additional details
        if (skill.examples && skill.examples.trim()) completedFields += 0.5;
        if (skill.level && skill.level.trim()) completedFields += 0.5;
    });

    return totalFields > 0 ? Math.min(completedFields / totalFields, 1.0) : 0.0;
}

/**
 * Calculate goals completeness based on goals data
 * @param {Array} goals - Array of goal objects
 * @returns {number} Completion score (0.0 to 1.0)
 */
function calculateGoalsCompleteness(goals) {
    if (!goals || goals.length === 0) return 0.0;

    let totalFields = 0;
    let completedFields = 0;

    goals.forEach(goal => {
        // Check required fields
        totalFields += 4; // title, description, timeframe, priority
        if (goal.title && goal.title.trim()) completedFields++;
        if (goal.description && goal.description.trim()) completedFields++;
        if (goal.timeframe && goal.timeframe.trim()) completedFields++;
        if (goal.priority && goal.priority.trim()) completedFields++;

        // Bonus for additional details
        if (goal.metrics && goal.metrics.trim()) completedFields += 0.5;
        if (goal.obstacles && goal.obstacles.trim()) completedFields += 0.5;
    });

    return totalFields > 0 ? Math.min(completedFields / totalFields, 1.0) : 0.0;
}

/**
 * Calculate board member completeness (mentors, coaches, etc.)
 * @param {Array} boardMembers - Array of board member objects
 * @returns {number} Completion score (0.0 to 1.0)
 */
function calculateBoardCompleteness(boardMembers) {
    if (!boardMembers || boardMembers.length === 0) return 0.0;

    let totalFields = 0;
    let completedFields = 0;

    boardMembers.forEach(member => {
        // Check required fields
        totalFields += 4; // name, relationship, expertise, value
        if (member.name && member.name.trim()) completedFields++;
        if (member.relationship && member.relationship.trim()) completedFields++;
        if (member.expertise && member.expertise.trim()) completedFields++;
        if (member.value && member.value.trim()) completedFields++;

        // Bonus for additional details
        if (member.contact && member.contact.trim()) completedFields += 0.3;
        if (member.lastContact && member.lastContact.trim()) completedFields += 0.3;
        if (member.notes && member.notes.trim()) completedFields += 0.4;
    });

    return totalFields > 0 ? Math.min(completedFields / totalFields, 1.0) : 0.0;
}

/**
 * Determine advisor readiness based on data completeness
 * @param {Object} completionScores - Completion scores from calculateCompletionScores
 * @returns {Object} Readiness assessment for each advisor type
 */
function assessAdvisorReadiness(completionScores) {
    return {
        skills: completionScores.skills > 0.3,
        goals: completionScores.goals > 0.2 && completionScores.skills > 0.4,
        boardMembers: completionScores.goals > 0.5 && completionScores.skills > 0.6,
        strategic: Object.values(completionScores).every(score => score > 0.7)
    };
}

/**
 * Analyze skill-goal alignment
 * @param {Array} superpowers - User's superpowers/skills
 * @param {Array} goals - User's goals
 * @returns {Object} Alignment analysis
 */
function analyzeSkillGoalAlignment(superpowers = [], goals = []) {
    const alignment = {
        alignedGoals: [],
        skillGaps: [],
        leverageOpportunities: [],
        alignmentScore: 0
    };

    if (goals.length === 0 || superpowers.length === 0) {
        return alignment;
    }

    // Simple keyword matching for alignment
    goals.forEach(goal => {
        const goalText = `${goal.title} ${goal.description}`.toLowerCase();
        const matchingSkills = superpowers.filter(skill => {
            const skillText = `${skill.name} ${skill.description} ${skill.category}`.toLowerCase();
            return goalText.includes(skill.name.toLowerCase()) ||
                   skillText.includes(goal.title.toLowerCase());
        });

        if (matchingSkills.length > 0) {
            alignment.alignedGoals.push({
                goal: goal.title,
                skills: matchingSkills.map(s => s.name)
            });
        } else {
            alignment.skillGaps.push(goal.title);
        }
    });

    // Calculate alignment score
    alignment.alignmentScore = alignment.alignedGoals.length / goals.length;

    return alignment;
}

/**
 * Identify board gap analysis
 * @param {Object} userData - Complete user data
 * @param {Array} goals - User's goals
 * @returns {Object} Board gap analysis
 */
function analyzeBoardGaps(userData, goals = []) {
    const boardTypes = ['mentors', 'coaches', 'sponsors', 'connectors', 'peers'];
    const gaps = {
        missingTypes: [],
        underrepresentedTypes: [],
        recommendations: []
    };

    boardTypes.forEach(type => {
        const members = userData[type] || [];
        if (members.length === 0) {
            gaps.missingTypes.push(type);
        } else if (members.length < 2) {
            gaps.underrepresentedTypes.push(type);
        }
    });

    // Generate recommendations based on goals
    goals.forEach(goal => {
        if (goal.title.toLowerCase().includes('career') || goal.title.toLowerCase().includes('promotion')) {
            if (!userData.mentors?.length) gaps.recommendations.push('Consider adding a mentor for career guidance');
            if (!userData.sponsors?.length) gaps.recommendations.push('A sponsor could help with promotion opportunities');
        }
        if (goal.title.toLowerCase().includes('network') || goal.title.toLowerCase().includes('connection')) {
            if (!userData.connectors?.length) gaps.recommendations.push('Connectors can help expand your professional network');
        }
    });

    return gaps;
}

/**
 * Determine the user's journey stage based on completion scores
 * @param {Object} completionScores - Completion scores
 * @returns {string} Journey stage: 'beginner', 'developing', 'strategic', 'optimizing'
 */
function determineJourneyStage(completionScores) {
    const overall = completionScores.overall;

    if (overall < 0.3) return 'beginner';
    if (overall < 0.6) return 'developing';
    if (overall < 0.8) return 'strategic';
    return 'optimizing';
}

/**
 * Get context-aware insights for advisor prompts
 * @param {Object} userData - Complete user data
 * @returns {Object} Intelligent insights for enhanced prompts
 */
function getIntelligentInsights(userData) {
    const completionScores = calculateCompletionScores(userData);
    const readiness = assessAdvisorReadiness(completionScores);
    const alignment = analyzeSkillGoalAlignment(userData.superpowers, userData.goals);
    const boardGaps = analyzeBoardGaps(userData, userData.goals);
    const journeyStage = determineJourneyStage(completionScores);

    return {
        completionScores,
        readiness,
        alignment,
        boardGaps,
        journeyStage,
        insights: {
            dataRichness: journeyStage,
            primaryFocus: determinePrimaryFocus(completionScores),
            nextSteps: generateNextSteps(completionScores, readiness),
            urgentActions: generateUrgentActions(userData, alignment, boardGaps)
        }
    };
}

/**
 * Determine primary focus area based on completion scores
 * @param {Object} completionScores - Completion scores
 * @returns {string} Primary focus area
 */
function determinePrimaryFocus(completionScores) {
    const lowest = Object.keys(completionScores)
        .filter(key => key !== 'overall')
        .reduce((min, key) =>
            completionScores[key] < completionScores[min] ? key : min
        );

    return lowest;
}

/**
 * Generate next steps based on readiness
 * @param {Object} completionScores - Completion scores
 * @param {Object} readiness - Readiness assessment
 * @returns {Array} Next steps
 */
function generateNextSteps(completionScores, readiness) {
    const steps = [];

    if (!readiness.skills) {
        steps.push('Define your superpowers and core skills');
    }
    if (!readiness.goals) {
        steps.push('Clarify your career goals and vision');
    }
    if (!readiness.boardMembers) {
        steps.push('Begin identifying potential board members');
    }
    if (readiness.strategic) {
        steps.push('Optimize your board composition and relationships');
    }

    return steps;
}

/**
 * Generate urgent actions based on analysis
 * @param {Object} userData - Complete user data
 * @param {Object} alignment - Skill-goal alignment
 * @param {Object} boardGaps - Board gap analysis
 * @returns {Array} Urgent actions
 */
function generateUrgentActions(userData, alignment, boardGaps) {
    const actions = [];

    if (alignment.alignmentScore < 0.3) {
        actions.push('Address skill-goal misalignment');
    }

    if (boardGaps.missingTypes.length > 3) {
        actions.push('Build your board foundation - start with mentors');
    }

    // Check for stale relationships
    const allMembers = [
        ...(userData.mentors || []),
        ...(userData.coaches || []),
        ...(userData.sponsors || []),
        ...(userData.connectors || []),
        ...(userData.peers || [])
    ];

    const staleMembers = allMembers.filter(member => {
        const lastContact = member.lastContact;
        if (!lastContact) return true;

        const contactDate = new Date(lastContact);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        return contactDate < threeMonthsAgo;
    });

    if (staleMembers.length > 0) {
        actions.push(`Reconnect with ${staleMembers.length} board members`);
    }

    return actions;
}

// Export functions for use in other modules
window.AdvisorIntelligence = {
    calculateCompletionScores,
    assessAdvisorReadiness,
    analyzeSkillGoalAlignment,
    analyzeBoardGaps,
    determineJourneyStage,
    getIntelligentInsights
};