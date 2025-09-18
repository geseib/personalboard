# AI Prompt Mapping - Personal Board of Directors

This document maps all AI advisor prompts to their trigger locations in the application and shows which prompts are actively used vs. available but not implemented.

## 🎯 **Active AI Features (4 Active Triggers)**

### 1. **Goals Page - AI Advisor Button**
- **Trigger**: "Get AI Guidance" button on Goals form modal
- **Prompt Used**: `goals_advisor`
- **Function**: `getGoalsAdvisorGuidance()`
- **Purpose**: Helps refine and improve career goal setting
- **Input Data**: Current goal form data, all user goals, complete board data
- **Output**: Strategic questions and recommendations for better goal setting

### 2. **Board Members - AI Advisor Button**
- **Trigger**: "Get AI Guidance" button on any board member form modal
- **Prompt Used**: `board_member_advisor`
- **Function**: `getBoardMemberAdvisorGuidance()`
- **Applies To**:
  - Mentors page form
  - Coaches page form
  - Sponsors page form
  - Connectors page form
  - Peers page form
- **Purpose**: Provides guidance for building relationships with specific board member types
- **Input Data**: Member type, current form data, goals, learn content, existing members
- **Output**: Pointed questions, recommendations, and suggested form entries

### 3. **Board Analysis Page - Automatic Analysis**
- **Trigger**: Automatically loads when viewing "Board" page
- **Prompt Used**: `board_analysis_advisor`
- **Function**: `getBoardAnalysisAdvisorGuidance()`
- **Purpose**: Comprehensive analysis of complete board composition and effectiveness
- **Input Data**: Complete board data with all members
- **Output**: Strategic analysis, gaps identification, and optimization recommendations

### 4. **Board Analysis Page - Generic Fallback**
- **Trigger**: When user is not authenticated or API fails
- **Prompt Used**: Static generic advice (no AI call)
- **Function**: `getGenericBoardAdvice()`
- **Purpose**: Provides helpful board management advice without requiring authentication

---

## 📋 **Available But Not Implemented (4 Unused Prompts)**

### 1. **Form Completion Assistance** ⚠️ *Not Used*
- **Prompt Available**: `form_completion`
- **Function**: `getFormCompletionGuidance()`
- **Potential Use**: Could provide suggestions for completing any board member or goal forms
- **Status**: Implemented in backend but no UI triggers

### 2. **Goal-Board Alignment Analysis** ⚠️ *Not Used*
- **Prompt Available**: `goal_alignment`
- **Function**: `getGoalAlignmentGuidance()`
- **Potential Use**: Could analyze connections between goals and current board members
- **Status**: Implemented in backend but no UI triggers

### 3. **Connection & Networking Suggestions** ⚠️ *Not Used*
- **Prompt Available**: `connection_suggestions`
- **Function**: `getConnectionSuggestions()`
- **Potential Use**: Could suggest networking strategies and potential connections
- **Status**: Implemented in backend but no UI triggers

### 4. **General Board Analysis** ⚠️ *Not Used*
- **Prompt Available**: `board_analysis`
- **Function**: `getBoardAnalysis()`
- **Potential Use**: Simpler board analysis (vs. the more comprehensive `board_analysis_advisor`)
- **Status**: Implemented in backend but no UI triggers

---

### 5. **Skills/Superpowers - AI Advisor Button**
- **Trigger**: "Get AI Guidance" button on You page skills section
- **Prompt Used**: `superpowers_advisor`
- **Function**: `getSuperpowersAdvisorGuidance()`
- **Purpose**: Strategic guidance for identifying and leveraging key skills for career advancement and board relationships
- **Input Data**: Skill category, current skill data, all user skills, goals, complete board data
- **Output**: Questions to identify key differentiating skills, recommendations for leverage, and mutual value creation strategies

---

## 📊 **Summary Statistics**

| Category | Count | Details |
|----------|-------|---------|
| **Total Prompts in System** | 9 | All implemented in admin interface |
| **Active UI Triggers** | 4 | Currently implemented in the application |
| **Skills Guidance Available** | 1 | New superpowers advisor for skills optimization |
| **Unused Prompts** | 4 | Available but no UI implementation |
| **Pages with AI Features** | 6 | Goals + 5 board member pages + Board analysis |
| **Pages with Potential AI** | 1 | "You" page (skills section) - superpowers_advisor ready |

---

## 🎯 **Admin Interface Verification**

The admin interface shows **9 prompt cards** organized by groupings:

✅ **Form Assistance (1)**
- form_completion

✅ **Relationship Guidance (2)**
- board_member_advisor *(enhanced with skills and mutual value focus)*
- mentor_advisor *(legacy - now consolidated into board_member_advisor)*

✅ **Strategic Analysis (3)**
- goal_alignment
- board_analysis
- board_analysis_advisor *(enhanced with skills leveraging opportunities)*

✅ **Goal Setting (1)**
- goals_advisor

✅ **Networking (1)**
- connection_suggestions

✅ **Skills & Development (1)**
- superpowers_advisor *(NEW - strategic skills guidance for career advancement)*

**Key Enhancements Made:**
- **board_member_advisor**: Now includes skills-based mutual value creation and opportunity identification
- **board_analysis_advisor**: Enhanced to analyze skills leverage opportunities for board relationships
- **superpowers_advisor**: New prompt focusing on identifying 2-4 key differentiating skills for career advancement

---

## 🚀 **Potential Improvements**

1. **Skills Enhancement**: Add AI guidance to Technical/Business/Organization skills using `form_completion` prompt
2. **Goal-Board Connection**: Implement `goal_alignment` to show connections between goals and board members
3. **Networking Assistance**: Add `connection_suggestions` to help users find new board members
4. **Smart Form Help**: Use `form_completion` to assist with any incomplete forms

The current implementation focuses on the most impactful AI features while keeping simpler prompts available for future enhancement.