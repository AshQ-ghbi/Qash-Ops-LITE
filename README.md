# Qash-Ops-LITE 🛡️

AWS security and IAM posture auditor

Qash-Ops Lite is a React-based security tool designed to audit AWS IAM policies and CloudFormation templates for vulnerabilities. By evaluating JSON configurations against security best practices, the application identifies potential risks such as overly permissive access or unauthorized wildcard usage. The auditing process is powered exclusively by cloud-based AI via Amazon Bedrock (Claude 3 Haiku).

A free AWS security and IAM posture auditor. Paste an IAM policy, an S3 or KMS policy, or a CloudFormation template and get a risk level, categorized findings, and AWS CLI commands to fix them.

Built for the **AWS Bharat Builds Tour: First Commit** hackathon (Track 1, Ship It).

**Deployed Link:** https://main.d3so1bcas2zaov.amplifyapp.com/


## How It Works

**1. Data Ingestion**
The process begins when a user selects a sample template or pastes a custom AWS IAM policy or CloudFormation template (in valid JSON format) into the browser-based editor.

**2. Traffic & Cost Control**
Before analysis, the request passes through a rate-limiting mechanism. This ensures fair usage, prevents API abuse, and keeps cloud compute costs strictly managed. If limits are exceeded, the app pauses requests until the service window resets.

**3. AI Posture Analysis**
The JSON payload is routed to Amazon Bedrock, where Claude 3 Haiku acts as the sole auditing engine. The AI evaluates the configuration against AWS security best practices, analyzing resource permissions, condition keys, and identifying potential wildcard exploits or privilege escalation paths.

**4. Threat Categorization**
The system parses the AI's evaluation and translates it into an actionable security posture metric. The frontend dynamically updates to categorize the finding into one of four expected risk tiers: **Critical**, **High**, **Medium**, or **Low, compliant**].



## Installation

Follow these steps to set up and run Qash-Ops Lite locally:

Clone the repository:

git clone https://github.com/yourusername/qash-ops-lite.git
cd qash-ops-lite


Install dependencies:

npm install

# or yarn install


Configure environment variables:
Create a .env file in the root directory of your project and add your AWS and API configurations.

VITE_AWS_REGION=your-aws-region
VITE_API_ENDPOINT=https://your-api-gateway-url.amazonaws.com/prod


(Note: Prefix with REACT_APP_ if using Create React App instead of Vite).

Start the development server:

npm run dev
# or 'npm start' depending on your setup


The application will launch and typically be available at http://localhost:5173 or http://localhost:3000



## Configuration

Two constants at the top of `src/App.jsx` control the mode:

| Constant | Default | Meaning |
| --- | --- | --- |
| `PUBLIC_API_URL` | `""` | Your API Gateway invoke URL. |
| `SELF_HOST` | `false` | Set to `true` to show an API URL field in the header, so each visitor can enter their own endpoint. |

The endpoint URL is not a secret and will be visible in the browser, so protect the backend with server-side limits. See the Self-Host Guide tab in the app.


## Deploy

The repo includes `amplify.yml`. To deploy on AWS Amplify Hosting:

1. Push this repo to GitHub.
2. In Amplify, choose **Host web app**, connect the repo, and keep the detected build settings.
3. Deploy. The build runs `npm install` and `npm run build`, and publishes the `dist` folder.

## Usage

1.Navigate to the Audit Engine tab in the application.
2.Select one of the Sample policies to populate the editor, or paste your own custom AWS IAM policy or CloudFormation template in valid JSON format.
3.Click Run Analysis to send the configuration to the Bedrock backend.
4.Review the generated risk assessment and expected severity rating (Critical, High, Medium, or Low).


## Privacy
- Never paste access keys, secret keys, session tokens, or personal data.
  

## Project structure

```
-LICENSE
├── index.html          # Entry page
├── amplify.yml         # AWS Amplify build settings
├── package.json
├── vite.config.js
└── src
    ├── main.jsx        # React entry point
    └── App.jsx         # The whole app: UI, built-in analyzer, and Cloud AI client
```


## Tech Stack

React 18, Vite 5, and Tailwind CSS 3 (compiled at build time through PostCSS). No router and no icon libraries.
Hosting: AWS Amplify (configured for continuous deployment)
AI Backend: **Amazon Bedrock (Claude 3 Haiku)**


## License

Apache-2.0. See [LICENSE](LICENSE).

## © Ashish Kumar
