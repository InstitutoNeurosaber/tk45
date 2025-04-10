import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import * as React from 'react';
import { TicketCreatedEmail } from '../components/EmailTemplates/templates/TicketCreatedEmail';
import { StatusChangedEmail } from '../components/EmailTemplates/templates/StatusChangedEmail';
import { NewCommentEmail } from '../components/EmailTemplates/templates/NewCommentEmail';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  trigger: string;
}

interface TicketData {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  userName: string;
  userEmail: string;
  oldStatus?: string;
  newStatus?: string;
  commentText?: string;
  commentAuthor?: string;
  commentedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private templates: Map<string, EmailTemplate>;
  private baseUrl: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.templates = new Map();
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  }

  public setTemplates(templates: EmailTemplate[]) {
    templates.forEach(template => {
      this.templates.set(template.trigger, template);
    });
  }

  private getTicketUrl(ticketId: string): string {
    return `${this.baseUrl}/tickets/${ticketId}`;
  }

  private async renderEmailTemplate(trigger: string, data: TicketData): Promise<string> {
    const ticketUrl = this.getTicketUrl(data.id);

    switch (trigger) {
      case 'created':
        return render(React.createElement(TicketCreatedEmail, {
          userName: data.userName,
          ticketId: data.id,
          ticketTitle: data.title,
          ticketDescription: data.description || '',
          createdAt: data.createdAt || new Date().toLocaleString(),
          ticketUrl: ticketUrl,
        }));

      case 'status_changed':
        return render(React.createElement(StatusChangedEmail, {
          userName: data.userName,
          ticketId: data.id,
          ticketTitle: data.title,
          oldStatus: data.oldStatus || '',
          newStatus: data.status || '',
          updatedAt: data.updatedAt || new Date().toLocaleString(),
          ticketUrl: ticketUrl,
        }));

      case 'commented':
        return render(React.createElement(NewCommentEmail, {
          userName: data.userName,
          ticketId: data.id,
          ticketTitle: data.title,
          commentText: data.commentText || '',
          commentAuthor: data.commentAuthor || '',
          commentedAt: data.commentedAt || new Date().toLocaleString(),
          ticketUrl: ticketUrl,
        }));

      default:
        throw new Error(`Template not found for trigger: ${trigger}`);
    }
  }

  public async sendEmail(trigger: string, data: TicketData): Promise<void> {
    const template = this.templates.get(trigger);
    if (!template) {
      throw new Error(`Template not found for trigger: ${trigger}`);
    }

    const subject = template.subject
      .replace(/#{ticketId}/g, data.id)
      .replace(/{ticketTitle}/g, data.title);

    const html = await this.renderEmailTemplate(trigger, data);

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: data.userEmail,
        subject,
        html,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }
}

export const emailService = new EmailService(); 