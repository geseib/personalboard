# Personal Board of Directors

Build and manage your professional support network with an interactive web application that helps you strategically organize mentors, coaches, sponsors, connectors, and peers to accelerate your career growth.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🎯 Overview

Personal Board of Directors is a career development tool that helps professionals build and maintain strategic relationships. Just as companies have boards of directors to provide guidance and oversight, individuals can benefit from assembling their own "board" of advisors to support their career journey.

## 🆕 What's New in Version 2.0.0

### Authentication & Access System
- **Styled Authentication Modal**: Beautiful, user-friendly access code entry interface
- **Flexible Access Model**: Core features free for all, AI features require facilitator code
- **Clear Error Messages**: Specific feedback for expired, invalid, or already-used codes
- **Token Persistence**: Authentication survives page reloads and backup restoration

### Enhanced User Experience
- **Improved Tooltips**: Larger, more readable tooltips with detailed guidance
- **Skills Clarification**: Comprehensive explanations for Technical, Business, and Organization skills
- **Goal Expectations**: Clear guidance on recommended number of goals per timeframe
- **Professional Design**: Consistent, polished UI throughout the application

### Smart PDF Generation
- **Works Without Authentication**: Generate PDFs even without AI features
- **Generic Advice Option**: Professional guidance for non-authenticated users
- **AI-Enhanced Content**: Personalized analysis when authenticated
- **Comprehensive Backups**: Export includes authentication tokens and board analysis

## ✨ Features

### Core Functionality (Free - No Code Required)
- **Interactive Board Management**: Add, edit, and organize your professional relationships across five key categories
- **Goal Setting & Tracking**: Define short-term (3 months), medium-term (1 year), and long-term (5+ years) career goals
- **Skills Documentation**: Track your Technical, Business, and Organization superpowers with proficiency levels
- **Visual Timeline**: See your board members organized by meeting cadence in an intuitive timeline view
- **PDF Export**: Generate a professional PDF summary with actionable guidance
- **Data Backup/Restore**: Comprehensive JSON export/import including all data and settings
- **Professional Tooltips**: Context-sensitive help throughout the application
- **Video Tutorials**: Integrated guides for getting started

### AI-Powered Assistance (Requires Access Code)
- **Smart Suggestions**: Get AI-powered recommendations for building relationships and setting goals
- **Personalized Board Analysis**: Receive custom insights on gaps and opportunities in your professional network
- **Contextual Guidance**: Access role-specific AI advice for each type of board member
- **Goal Alignment**: Understand how your board can help achieve your career objectives
- **Available Through**: Facilitated workshops and training sessions

### Learning Resources
- **Educational Content**: Built-in explanations for each board member type
- **Video Tutorials**: Integrated video guides for getting started
- **Best Practices**: Learn how to approach and maintain professional relationships

### User Feedback System
- **GitHub Integration**: Submit bug reports and feature requests directly from the app
- **Floating Action Button**: Easy access to feedback form without leaving your workflow

### Administrative Features
- **AI Prompt Management**: Configure and customize AI guidance prompts for different scenarios
- **Access Token System**: Generate and distribute access codes for AI features
- **Theme Customization**: Create and manage custom visual themes
- **Usage Analytics**: Monitor application usage and prompt effectiveness

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- AWS Account (for deployment)
- GitHub Personal Access Token (for feedback system)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/geseib/personalboard.git
cd personalboard
```

2. **Install dependencies**
```bash
npm install
```

3. **Run the development server**
```bash
npm start
```

4. **Open in browser**
Navigate to `http://localhost:1234` to view the application

### Deployment

The application is deployed using AWS SAM (Serverless Application Model).

1. **Configure AWS credentials**
```bash
aws configure
```

2. **Set environment variables**
```bash
export GITHUB_TOKEN=your_github_token_here
export HOSTED_ZONE_ID=your-hosted-zone-id
```

3. **Deploy the application**
```bash
./deploy.sh
```

This will:
- Build and deploy Lambda functions for AI guidance and feedback
- Set up API Gateway endpoints
- Configure S3 bucket for static hosting
- Create CloudFront distribution
- Set up Route 53 DNS (if configured)

## 🏗️ Architecture

### Frontend
- **Framework**: Vanilla JavaScript with modern ES6+
- **Styling**: Custom CSS with responsive design
- **Build Tool**: Parcel bundler
- **PDF Generation**: jsPDF library

### Backend
- **API**: AWS API Gateway with REST endpoints
- **Functions**: AWS Lambda (Node.js 18.x)
- **AI Integration**: Amazon Bedrock with Claude 3.5
- **Storage**: Browser localStorage for data persistence

### Infrastructure
- **Hosting**: S3 + CloudFront
- **DNS**: Route 53
- **IaC**: AWS SAM/CloudFormation
- **Monitoring**: CloudWatch

## 📚 Board Member Types

### Mentors
Senior professionals who provide wisdom and long-term career guidance through quarterly strategic sessions.

### Coaches
Skill-builders who help develop specific competencies through hands-on practice and regular feedback.

### Sponsors
Influential advocates who champion your advancement and open doors to opportunities.

### Connectors
Well-networked individuals who expand your professional network through strategic introductions.

### Peers
Colleagues at similar career levels who provide mutual support and diverse perspectives.

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Areas We Need Help

#### Frontend Development
- **UI/UX Improvements**: Enhance the user interface and experience
- **Mobile Optimization**: Improve responsive design for mobile devices
- **Accessibility**: Ensure WCAG compliance and keyboard navigation
- **Dark Mode**: Implement theme switching capability

#### Backend Development
- **API Enhancements**: Add new endpoints and improve existing ones
- **Authentication**: Implement user accounts and data sync
- **Database Integration**: Move from localStorage to persistent backend storage
- **Analytics**: Add usage tracking and insights

#### AI Features
- **Prompt Engineering**: Improve AI response quality and relevance
- **New AI Capabilities**: Add meeting preparation, email drafts, and networking strategies
- **Multi-language Support**: Extend AI guidance to support multiple languages
- **Admin Interface**: Enhance the administrative dashboard for better prompt and user management

#### Documentation
- **User Guides**: Create comprehensive documentation for end users
- **API Documentation**: Document backend APIs for developers
- **Video Tutorials**: Create educational content
- **Blog Posts**: Share career development best practices

#### Testing
- **Unit Tests**: Increase test coverage for JavaScript code
- **E2E Tests**: Implement Playwright or Cypress tests
- **Performance Testing**: Optimize load times and responsiveness
- **Cross-browser Testing**: Ensure compatibility across browsers

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Make your changes**
4. **Run tests** (when available)
5. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
6. **Push to the branch** (`git push origin feature/AmazingFeature`)
7. **Open a Pull Request**

### Development Guidelines

- Follow existing code style and conventions
- Add comments for complex logic
- Update documentation for new features
- Test your changes thoroughly
- Keep commits focused and atomic

### Reporting Issues

Use the in-app feedback button or create an issue on GitHub with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser and OS information

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with AWS Serverless technologies
- AI powered by Claude 3.5 (Anthropic)
- Inspired by career development best practices
- Community feedback and contributions

## 📬 Contact

- **GitHub Issues**: [Report bugs or request features](https://github.com/geseib/personalboard/issues)
- **Website**: [https://board.seibtribe.us](https://board.seibtribe.us)

---

**Start building your Personal Board of Directors today and take control of your career growth!**