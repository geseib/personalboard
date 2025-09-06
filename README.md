# Personal Board

A modern web application for managing your personal board of directors - the trusted advisors who guide your career and personal growth.

## Features

- **Interactive Board Management**: Add, edit, and track your mentors, coaches, connectors, sponsors, and peers
- **Visual Board Display**: See your board arranged around a conference table
- **Timeline Visualization**: Track meeting patterns and engagement over time
- **PDF Export**: Generate professional reports of your board and relationships
- **Educational Content**: Learn about building and maintaining a personal board of directors

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

## Deployment

This project is configured for deployment to AWS using CloudFormation, S3, CloudFront, and Route 53.

### Prerequisites for Deployment

- AWS CLI configured with appropriate permissions
- SAM CLI installed
- Route 53 hosted zone for your domain
- Hosted Zone ID environment variable set

### Deploy to AWS

1. **Set your hosted zone ID:**
   ```bash
   export HOSTED_ZONE_ID=your-hosted-zone-id-here
   ```

2. **Deploy the application:**
   ```bash
   npm run deploy
   ```

The deployment script will:
- Build the React application
- Deploy AWS infrastructure (S3, CloudFront, SSL certificate, Route 53)
- Upload files to S3 with appropriate caching headers
- Invalidate CloudFront cache

### Infrastructure

The deployment creates:
- **S3 Bucket**: Private bucket for hosting static files
- **CloudFront Distribution**: CDN with custom domain and SSL
- **SSL Certificate**: Auto-validated via Route 53
- **Route 53 Record**: DNS alias pointing to CloudFront

## Project Structure

```
personalboard/
├── app.js              # Main React application
├── style.css           # Application styles
├── index.html          # HTML entry point
├── utils.js            # Utility functions
├── package.json        # Dependencies and scripts
├── template.yaml       # CloudFormation/SAM template
├── samconfig.toml      # SAM CLI configuration
└── scripts/
    └── deploy.sh       # Deployment script
```

## Usage

### Managing Your Board

1. **Add Members**: Click the "+" button on any role page to add new board members
2. **Edit Members**: Use the edit icon on member cards to update information
3. **Set Cadence**: Use the slider to set meeting frequency for each member
4. **Take Notes**: Add engagement notes to track relationship development

### Understanding Roles

- **Mentors**: Experienced guides who share wisdom and open doors
- **Coaches**: Skill developers who provide targeted feedback
- **Connectors**: Network expanders who make valuable introductions
- **Sponsors**: Advocates who actively promote your advancement
- **Peers**: Journey companions who provide mutual support

### Exporting Data

- **PDF Export**: Generate a comprehensive board report
- **JSON Export**: Download your data for backup or analysis
- **JSON Import**: Upload previously exported data

## Technologies Used

- **React 18**: Modern UI framework
- **Parcel**: Fast, zero-configuration build tool
- **jsPDF**: PDF generation for reports
- **AWS SAM**: Infrastructure as code
- **AWS Services**: S3, CloudFront, Route 53, ACM

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

Private project - All rights reserved.