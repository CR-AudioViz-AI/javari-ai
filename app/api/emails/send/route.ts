import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Email templates
const templates = {
  welcome: {
    subject: '🎉 Welcome to Javari Library! Your 112 Free eBooks Await',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Welcome to Javari Library!</h1>
        <p>Hi {{name}},</p>
        <p>You now have instant access to <strong>112 FREE professional eBooks</strong> covering:</p>
        <ul>
          <li>AI & Technology</li>
          <li>Business & Marketing</li>
          <li>Real Estate & Finance</li>
          <li>Personal Development</li>
        </ul>
        <p><a href="https://craudiovizai.com/apps/javari-library" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Browse Your Library Now →</a></p>
        <p>Best,<br>The Javari Library Team</p>
      </div>
    `
  },
  subscription_welcome: {
    subject: '🎊 Welcome to Javari Library Premium!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Welcome to Premium!</h1>
        <p>Hi {{name}},</p>
        <p>Congratulations! You now have full access to:</p>
        <ul>
          <li>✅ <strong>301 Professional eBooks</strong></li>
          <li>✅ <strong>{{credits}} Credits Added</strong></li>
          <li>✅ <strong>Audiobook Conversions</strong></li>
          <li>✅ <strong>Priority Support</strong></li>
        </ul>
        <p><a href="https://craudiovizai.com/apps/javari-library" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Explore Your Library →</a></p>
      </div>
    `
  },
  conversion_complete: {
    subject: '🎧 Your Audiobook is Ready!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Your Audiobook is Ready!</h1>
        <p>Hi {{name}},</p>
        <p>Great news! Your audiobook conversion of <strong>{{bookTitle}}</strong> is complete.</p>
        <p><a href="{{downloadUrl}}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Download Your Audiobook →</a></p>
        <p>Enjoy listening!</p>
      </div>
    `
  }
};

export async function POST(request: NextRequest) {
  try {
    const { template, to, data } = await request.json();
    
    if (!template || !to) {
      return NextResponse.json({ error: 'Missing template or recipient' }, { status: 400 });
    }
    
    const emailTemplate = templates[template as keyof typeof templates];
    if (!emailTemplate) {
      return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
    }
    
    // Replace placeholders in template
    let html = emailTemplate.html;
    let subject = emailTemplate.subject;
    
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      });
    }
    
    const result = await resend.emails.send({
      from: 'Javari Library <library@craudiovizai.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    });
    
    // Log email sent
    await supabase.from('email_sequences').insert({
      user_id: data?.userId,
      sequence_name: template,
      status: 'sent',
      metadata: { emailId: result.id, to, template }
    });
    
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
