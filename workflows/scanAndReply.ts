import type { InboundWebhookPayload } from '@inboundemail/sdk';
import { Inbound } from '@inboundemail/sdk';
import { generateObject } from 'ai';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export async function scanAndReply(payload: InboundWebhookPayload) {
  "use workflow";

  console.log('[WORKFLOW START] scanAndReply workflow initiated', {
    emailId: payload.email.id,
    event: payload.event,
    timestamp: payload.timestamp,
    from: payload.email.from?.text,
    to: payload.email.to?.text,
    subject: payload.email.subject,
  });

  // Step 1: Analyze email for spam detection
  console.log('[WORKFLOW STEP] Starting spam detection analysis...', {
    emailId: payload.email.id,
  });
  const detectionResult = await analyzeEmailForSpam(payload);
  console.log('[WORKFLOW STEP] Spam detection analysis complete', {
    emailId: payload.email.id,
    isSpam: detectionResult.detectionResult.isSpam,
    confidence: detectionResult.detectionResult.confidence,
    reasoningLength: detectionResult.detectionResult.reasoning.length,
    referencesCount: detectionResult.detectionResult.references.length,
  });

  // Step 2: Generate reply based on detection results
  console.log('[WORKFLOW STEP] Starting reply generation...', {
    emailId: payload.email.id,
    classification: detectionResult.detectionResult.isSpam ? 'SPAM' : 'LEGITIMATE',
  });
  const reply = await generateReply(detectionResult, payload);
  console.log('[WORKFLOW STEP] Reply generation complete', {
    emailId: payload.email.id,
    replyLength: reply.length,
    replyPreview: reply.substring(0, 200) + (reply.length > 200 ? '...' : ''),
  });

  // Step 3: Send reply via Inbound API
  console.log('[WORKFLOW STEP] Starting reply sending...', {
    emailId: payload.email.id,
  });
  const sendResult = await sendReply(payload.email.id, reply, payload);
  console.log('[WORKFLOW STEP] Reply sending complete', {
    emailId: payload.email.id,
    sentEmailId: sendResult.id,
    messageId: sendResult.messageId,
  });

  console.log('[WORKFLOW COMPLETE] Email processing finished', {
    emailId: payload.email.id,
    isSpam: detectionResult.detectionResult.isSpam,
    confidence: detectionResult.detectionResult.confidence,
    replyGenerated: !!reply,
    replySent: !!sendResult,
    sentEmailId: sendResult?.id,
  });

  return {
    success: true,
    emailId: payload.email.id,
    detectionResult,
    reply,
    sendResult,
  };
}

async function analyzeEmailForSpam(payload: InboundWebhookPayload) {
  "use step";

  console.log('[STEP] analyzeEmailForSpam: Extracting email data', {
    emailId: payload.email.id,
    hasRaw: !!payload.email.parsedData?.raw,
    hasHeaders: !!payload.email.parsedData?.headers,
    hasHtml: !!payload.email.parsedData?.htmlBody,
    hasText: !!payload.email.parsedData?.textBody,
  });

  // Get raw email content and headers for analysis
  const rawEmail = payload.email.parsedData?.raw || '';
  const headers = payload.email.parsedData?.headers || {};
  const htmlBody = payload.email.parsedData?.htmlBody || '';
  const textBody = payload.email.parsedData?.textBody || '';
  const subject = payload.email.subject || '';
  const from = payload.email.from?.text || '';
  const to = payload.email.to?.text || '';

  console.log('[STEP] analyzeEmailForSpam: Email content sizes', {
    emailId: payload.email.id,
    rawEmailLength: rawEmail.length,
    htmlBodyLength: htmlBody.length,
    textBodyLength: textBody.length,
    headersCount: Object.keys(headers).length,
  });

  console.log('[STEP] analyzeEmailForSpam: Calling AI model for spam detection', {
    emailId: payload.email.id,
    model: 'gpt-5',
  });

  // Schema for spam detection results
  const spamDetectionSchema = z.object({
    isSpam: z.boolean().describe('Whether the email is identified as spam or malicious'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1, where 1 is highly confident'),
    reasoning: z.string().describe('Detailed explanation of the analysis and why the email was classified this way'),
    references: z.array(z.string()).describe('List of specific indicators, suspicious patterns, or references found in the email that influenced the decision'),
  });

  const startTime = Date.now();
  const { object } = await generateObject({
    model: openai('gpt-5'),
    schema: spamDetectionSchema,
    schemaName: 'SpamDetectionResult',
    schemaDescription: 'Structured spam detection analysis results including classification, confidence, reasoning, and specific indicators',
    prompt: `You are an advanced email security analyst. A user has forwarded the following email message to us because they want to know if it is safe to trust. Your job is to analyze this email and determine if it is spam, phishing, malicious, or safe.

CONTEXT: This email was forwarded to our security analysis service by a user who received it and is uncertain about its legitimacy. The user is asking for your expert evaluation to help them decide whether they can safely interact with this email.

CRITICAL: Examine all aspects of the email including headers, content, structure, and metadata patterns to provide a comprehensive safety assessment.

Email Details:
- From: ${from}
- To: ${to}
- Subject: ${subject}

Email Headers (raw):
${JSON.stringify(headers, null, 2)}

Email Raw Content:
${rawEmail}

Your task:
1. Examine the email headers for suspicious patterns (SPF, DKIM, DMARC failures, suspicious routing, etc.)
2. Analyze the email content for phishing indicators, suspicious links, urgency tactics, or malicious attachments
3. Check for social engineering patterns, impersonation attempts, or fraudulent requests
4. Evaluate the overall email structure and metadata for anomalies
5. Provide a confidence score based on the strength and number of indicators found
6. List specific references and indicators that led to your conclusion

Consider legitimate emails may have:
- Professional language and proper formatting
- Verified sender authentication (SPF/DKIM/DMARC)
- No suspicious links or requests for sensitive information
- Appropriate subject-to-content correlation

Return your analysis with:
- isSpam: true if the email is spam/malicious, false if it appears legitimate
- confidence: A score from 0 to 1 indicating how confident you are in the classification
- reasoning: A detailed explanation of your analysis
- references: A list of specific indicators, suspicious patterns, or concerns found`,
  });
  const analysisTime = Date.now() - startTime;

  console.log('[STEP] analyzeEmailForSpam: AI analysis complete', {
    emailId: payload.email.id,
    analysisTimeMs: analysisTime,
    result: {
      isSpam: object.isSpam,
      confidence: object.confidence,
      reasoningLength: object.reasoning.length,
      referencesCount: object.references.length,
    },
  });

  return {
    detectionResult: object,
    emailId: payload.email.id,
  };
}

async function generateReply(
  detectionData: { detectionResult: { isSpam: boolean; confidence: number; reasoning: string; references: string[] }; emailId: string },
  payload: InboundWebhookPayload
) {
  "use step";

  console.log('[STEP] generateReply: Starting reply generation', {
    emailId: detectionData.emailId,
    isSpam: detectionData.detectionResult.isSpam,
    confidence: detectionData.detectionResult.confidence,
  });

  const htmlBody = payload.email.parsedData?.htmlBody || payload.email.cleanedContent?.html || '';
  const textBody = payload.email.parsedData?.textBody || payload.email.cleanedContent?.text || '';
  const subject = payload.email.subject || '';
  const from = payload.email.from?.text || '';

  console.log('[STEP] generateReply: Email content sizes for reply generation', {
    emailId: detectionData.emailId,
    htmlBodyLength: htmlBody.length,
    textBodyLength: textBody.length,
  });

  console.log('[STEP] generateReply: Calling AI model for reply generation', {
    emailId: detectionData.emailId,
    model: 'gpt-5',
  });

  const startTime = Date.now();
  const { text } = await generateText({
    model: openai('gpt-5'),
    prompt: `You are an email security assistant providing a concise safety evaluation. A user forwarded an email to our service asking whether it is safe to trust.

CONTEXT: This email was forwarded to us by a user who wants to know if they can safely interact with it. Your response will be sent back to help the user make an informed decision about the email's safety.

Email Information:
- From: ${from}
- Subject: ${subject}

Email Content:
${textBody.substring(0, 2000)}${textBody.length > 2000 ? '\n... (truncated)' : ''}

Spam Detection Analysis:
- Classification: ${detectionData.detectionResult.isSpam ? 'SPAM/MALICIOUS' : 'LEGITIMATE'}
- Confidence Score: ${(detectionData.detectionResult.confidence * 100).toFixed(1)}%
- Key Concerns: ${detectionData.detectionResult.references.slice(0, 3).join('; ')}

Generate a SHORT, CONCISE email reply (3-5 sentences maximum) that will be sent to the user. The reply should:
1. Acknowledge they forwarded the email for a safety check
2. Clearly state if the email is SAFE or UNSAFE
3. Provide a brief explanation (1-2 sentences) of the main finding
4. Give clear, actionable guidance (one sentence)

IMPORTANT FORMATTING RULES:
- Write like a plaintext email - simple, professional, direct
- Use minimal HTML ONLY for code examples or technical terms (use <code> tags)
- NO fancy colors, styling, backgrounds, or visual elements
- NO complex HTML structure or tables
- CRITICAL: Use GENEROUS line breaks with <br><br> tags to make the email easy to read
- Add <br><br> after each sentence or thought to create visual spacing
- Add <br><br> between different sections/paragraphs
- Add <br><br> before the closing/signature
- The email should have plenty of white space - not be a dense block of text
- Keep it brief and to the point

Format as HTML but make it look and read like a plaintext email. Use <br><br> liberally for readability. Example structure:

<html>
<body>

Hi,<br><br>

Thanks for forwarding this email for review. This email appears [SAFE/UNSAFE - be clear].<br><br>

[Brief 1-2 sentence explanation - add <br><br> after each sentence]<br><br>

[One sentence guidance on what to do]<br><br>

Best regards,<br>
Security Analysis

</body>
</html>`,
  });
  const generationTime = Date.now() - startTime;

  console.log('[STEP] generateReply: Reply generation complete', {
    emailId: detectionData.emailId,
    generationTimeMs: generationTime,
    replyLength: text.length,
    replyPreview: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
  });

  // Append Inbound footer to the HTML
  const footer = '<br><br>powered by<br><a href="https://inbound.new/?utm_source=inbound-security&utm_campaign=susbound"><img src="https://inbound.new/images/inbound-wordmark.png" alt="Inbound"></a>';
  
  // If the HTML has closing tags, insert footer before them, otherwise append at the end
  let replyHtml = text;
  if (replyHtml.includes('</body>')) {
    replyHtml = replyHtml.replace('</body>', footer + '</body>');
  } else if (replyHtml.includes('</html>')) {
    replyHtml = replyHtml.replace('</html>', footer + '</html>');
  } else {
    replyHtml = replyHtml + footer;
  }

  return replyHtml;
}

async function sendReply(
  emailId: string,
  replyHtml: string,
  payload: InboundWebhookPayload
) {
  "use step";

  console.log('[STEP] sendReply: Initializing Inbound SDK', {
    emailId,
  });

  const inbound = new Inbound(process.env.INBOUND_API_KEY!);

  // Extract plain text from HTML for the text version
  // Simple extraction - remove HTML tags
  const replyText = replyHtml
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();

  // Get verified from address (must be from a verified domain)
  // The "to" field will default to replying to whoever sent the email to our endpoint
  // (which should be the user who forwarded it to us)
  const fromAddress = process.env.INBOUND_REPLY_FROM || 'susdev@inbound.delivery';

  console.log('[STEP] sendReply: Sending reply via Inbound API', {
    emailId,
    fromAddress,
    replyLength: replyHtml.length,
  });

  const { data, error } = await inbound.reply(emailId, {
    from: fromAddress,
    html: replyHtml,
    text: replyText,
  });

  if (error) {
    console.error('[STEP] sendReply: Error sending reply', {
      emailId,
      error,
    });
    throw new Error(`Failed to send reply: ${error}`);
  }

  console.log('[STEP] sendReply: Reply sent successfully', {
    emailId,
    sentEmailId: data?.id,
    messageId: data?.messageId,
  });

  return data!;
}

