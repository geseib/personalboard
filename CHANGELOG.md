# Changelog

All notable changes to the Personal Board of Directors project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-10

### Added
- **Authentication System**: Professional modal interface for access code entry
- **Flexible Access Model**: Core features free, AI features require facilitator code
- **Enhanced Tooltips**: Larger, more readable tooltips with comprehensive guidance
- **Skills Clarification**: Detailed explanations for Technical, Business, and Organization skills
- **Goal Guidance**: Clear expectations for number of goals per timeframe
- **Generic Board Advice**: Professional guidance for non-authenticated PDF exports
- **Token Persistence**: Authentication tokens included in backup/restore
- **Board Analysis Storage**: AI analysis cached and included in backups
- **Error Handling**: Specific error messages for authentication failures
- **Bottom Tooltips**: New tooltip positioning for top navigation buttons

### Changed
- **PDF Generation**: Now works without authentication (with generic advice)
- **Backup Format**: Enhanced to include authentication and board analysis
- **Tooltip Design**: Increased size, improved readability, better styling
- **Button Labels**: "Download JSON" renamed to "Download Backup"
- **Skills Tooltips**: Added proficiency level guidance and specific examples
- **Goals Tooltips**: Added minimum goal count recommendations

### Fixed
- **CORS Issues**: Fixed preflight errors in authentication endpoints
- **Module Format**: Converted activate function from CommonJS to ES modules
- **DynamoDB Errors**: Fixed reserved keyword issue with TTL field
- **Token Validation**: Improved token expiration checking
- **Base64 Parsing**: Fixed request body parsing in Lambda functions

### Security
- **JWT Validation**: Enhanced token validation and expiration checking
- **Error Messages**: Sanitized error messages to prevent information leakage
- **Token Storage**: Secure localStorage implementation with validation

## [1.0.1] - 2024-12-15

### Added
- GitHub feedback integration system
- Floating feedback button
- Video tutorials for each section
- Meeting cadence timeline visualization

### Changed
- Improved UI responsiveness
- Enhanced PDF export formatting
- Better error handling for API calls

### Fixed
- PDF generation memory issues
- Mobile viewport scaling
- API timeout handling

## [1.0.0] - 2024-11-01

### Added
- Initial release
- Core board management functionality
- Goal setting and tracking
- Basic AI integration
- PDF export capability
- JSON import/export
- Educational content for board roles
- CloudFront CDN deployment
- S3 static hosting