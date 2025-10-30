import { NextRequest, NextResponse } from 'next/server';
import type { InboundWebhookPayload } from '@inboundemail/sdk';
import { start } from 'workflow/api';
import { scanAndReply } from '@/workflows/scanAndReply';

export async function POST(request: NextRequest) {
  try {
    const payload: InboundWebhookPayload = await request.json();
    
    // Validate that we received a valid webhook payload
    if (!payload.event || !payload.email) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    // Log the webhook for debugging
    console.log('Received Inbound webhook:', {
      event: payload.event,
      emailId: payload.email.id,
      from: payload.email.from?.text,
      to: payload.email.to?.text,
      subject: payload.email.subject,
      timestamp: payload.timestamp,
    });

    // Start the workflow asynchronously - doesn't block the response
    await start(scanAndReply, [payload]);
    
    return NextResponse.json({ 
      success: true,
      message: 'Webhook received and workflow started' 
    }, { status: 200 });
  } catch (error) {
    console.error('Error processing Inbound webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

