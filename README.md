# Susbound - Email Security Analysis

## Usage

Forward any email you receive that you think might be suspicious to **sus@inbound.delivery** and within a couple of minutes you will receive an AI-powered security review analyzing whether the email is safe or potentially malicious.

## Development

This is a [Next.js](https://nextjs.org) project built with:
- Next.js 16
- Bun as the package manager
- Vercel Workflow for async email processing
- OpenAI GPT-5 for spam detection and reply generation
- Inbound Email API for receiving and sending emails

### Getting Started

First, install dependencies:

```bash
bun install
```

Then, run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Project Structure

```
susbound/
├── app/
│   ├── api/
│   │   └── inbound/
│   │       └── route.ts          # Webhook endpoint that receives emails
│   ├── page.tsx                  # Home page
│   └── layout.tsx                # Root layout
├── workflows/
│   └── scanAndReply.ts           # Workflow that processes emails:
│                                   # 1. Analyzes email for spam
│                                   # 2. Generates AI reply
│                                   # 3. Sends reply via Inbound API
└── next.config.ts                # Next.js config with Workflow integration
```

### Environment Variables

Required environment variables:
- `INBOUND_API_KEY` - Your Inbound API key for sending/receiving emails
- `OPENAI_API_KEY` - OpenAI API key for GPT-5 model
- `INBOUND_REPLY_FROM` - Verified email address to send replies from (optional, defaults to susdev@inbound.delivery)

### How It Works

1. User forwards suspicious email to `sus@inbound.delivery`
2. Inbound sends webhook to `/api/inbound` endpoint
3. API route starts async workflow `scanAndReply`
4. Workflow performs three steps:
   - **Step 1**: Analyzes email content and headers for spam/malicious indicators using GPT-5
   - **Step 2**: Generates a concise safety evaluation reply
   - **Step 3**: Sends the reply back to the user via Inbound API

### Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Workflow](https://useworkflow.dev/docs)
- [Inbound Email API](https://docs.inbound.new)
- [OpenAI API](https://platform.openai.com/docs)

---

<div align="center">
  <p>powered by</p>
  <a href="https://inbound.new/?utm_source=inbound-security&utm_campaign=susbound">
    <img src="https://inbound.new/images/inbound-wordmark.png" alt="Inbound" />
  </a>
</div>
