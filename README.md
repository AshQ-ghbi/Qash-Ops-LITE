# Qash-Ops-LITE

A free AWS security and IAM posture auditor. Paste an IAM policy, an S3 or KMS policy, or a CloudFormation template and get a risk level, categorized findings, and AWS CLI commands to fix them.

Built for the **AWS Bharat Builds Tour: First Commit** hackathon (Track 1, Ship It).

## How it works


### What the built-in analyzer checks



## Run it locally

You need Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints, usually http://localhost:5173.

To build for production:

```bash
npm run build
npm run preview
```

## Configuration

Two constants at the top of `src/App.jsx` control the mode:

| Constant | Default | Meaning |
| --- | --- | --- |
| `PUBLIC_API_URL` | `""` | Your API Gateway invoke URL. Leave it empty to run with the built-in analyzer only. Set it to enable the Cloud AI switch. |
| `SELF_HOST` | `false` | Set to `true` to show an API URL field in the header, so each visitor can enter their own endpoint. |

The endpoint URL is not a secret and will be visible in the browser, so protect the backend with server-side limits. See the Self-Host Guide tab in the app.

## Deploy

The repo includes `amplify.yml`. To deploy on AWS Amplify Hosting:

1. Push this repo to GitHub.
2. In Amplify, choose **Host web app**, connect the repo, and keep the detected build settings.
3. Deploy. The build runs `npm install` and `npm run build`, and publishes the `dist` folder.


## Privacy

- Never paste access keys, secret keys, session tokens, or personal data.

## Project structure

```
.
├── index.html          # Entry page
├── amplify.yml         # AWS Amplify build settings
├── package.json
├── vite.config.js
└── src
    ├── main.jsx        # React entry point
    └── App.jsx         # The whole app: UI, built-in analyzer, and Cloud AI client
```

## Tech

React 18, Vite 5, and Tailwind CSS 3 (compiled at build time through PostCSS). No router and no icon libraries.

## License

Apache-2.0. See [LICENSE](LICENSE).
