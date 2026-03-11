import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth/api-key';
import { OpenBankingClient } from '@/lib/open-banking/client';
import { PSD2Compliance } from '@/lib/open-banking/psd2-compliance';
import { AccountInfoService } from '@/lib/open-banking/account-info';
import { PaymentInitiationService } from '@/lib/open-banking/payment-initiation';
import { SCAValidator } from '@/middleware/sca-validation';
import { JWKHandler } from '@/lib/encryption/jwk-handler';
import { z } from 'zod';
import crypto from 'crypto';

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

// Request validation schemas
const AuthorizeRequestSchema = z.object({
  aspsp_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.enum(['accounts', 'payments', 'funds_confirmation']),
  state: z.string().min(1),
  user_id: z.string().uuid(),
});

const AccountInfoRequestSchema = z.object({
  consent_id: z.string().min(1),
  account_id: z.string().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

const PaymentInitiationSchema = z.object({
  consent_id: z.string().min(1),
  debtor_account: z.object({
    iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/),
  }),
  creditor_account: z.object({
    iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/),
    name: z.string().min(1),
  }),
  instructed_amount: z.object({
    currency: z.string().length(3),
    amount: z.string().regex(/^\d+\.\d{2}$/),
  }),
  remittance_information: z.string().max(140).optional(),
});

const ConsentStatusSchema = z.object({
  consent_id: z.string().min(1),
});

// Initialize services
const openBankingClient = new OpenBankingClient({
  environment: process.env.OPEN_BANKING_ENVIRONMENT || 'sandbox',
  clientId: process.env.OPEN_BANKING_CLIENT_ID!,
  clientSecret: process.env.OPEN_BANKING_CLIENT_SECRET!,
  certificate: process.env.OPEN_BANKING_CERTIFICATE!,
  privateKey: process.env.OPEN_BANKING_PRIVATE_KEY!,
});

const psd2Compliance = new PSD2Compliance({
  tppId: process.env.TPP_ID!,
  qwacCertificate: process.env.QWAC_CERTIFICATE!,
  qsealCertificate: process.env.QSEAL_CERTIFICATE!,
});

const accountInfoService = new AccountInfoService(openBankingClient);
const paymentService = new PaymentInitiationService(openBankingClient);
const scaValidator = new SCAValidator();
const jwkHandler = new JWKHandler();

// Utility functions
async function logTransaction(
  userId: string,
  operation: string,
  data: any,
  status: 'success' | 'error',
  errorMessage?: string
) {
  try {
    await supabase.from('open_banking_logs').insert({
      user_id: userId,
      operation,
      request_data: data,
      status,
      error_message: errorMessage,
      timestamp: new Date().toISOString(),
      ip_address: data.ip || null,
      user_agent: data.userAgent || null,
    });
  } catch (error) {
    console.error('Failed to log transaction:', error);
  }
}

async function validateConsent(consentId: string, userId: string) {
  const { data, error } = await supabase
    .from('open_banking_consents')
    .select('*')
    .eq('consent_id', consentId)
    .eq('user_id', userId)
    .eq('status', 'authorised')
    .single();

  if (error || !data) {
    throw new Error('Invalid or expired consent');
  }

  if (new Date(data.expires_at) < new Date()) {
    throw new Error('Consent has expired');
  }

  return data;
}

async function generateRequestSignature(payload: string, keyId: string) {
  const signature = await jwkHandler.signPayload(payload, keyId);
  return {
    'x-jws-signature': signature,
    'x-fapi-interaction-id': crypto.randomUUID(),
    'x-fapi-auth-date': new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await limiter.check(request, 10, 'OPEN_BANKING');

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const { valid, userId } = await validateApiKey(apiKey);
    if (!valid || !userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { operation } = body;

    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Common request metadata
    const requestMetadata = {
      ip: clientIp,
      userAgent,
      timestamp: new Date().toISOString(),
    };

    switch (operation) {
      case 'authorize': {
        const validatedData = AuthorizeRequestSchema.parse(body);
        
        // Generate authorization URL
        const authUrl = await openBankingClient.generateAuthUrl({
          aspspId: validatedData.aspsp_id,
          redirectUri: validatedData.redirect_uri,
          scope: validatedData.scope,
          state: validatedData.state,
        });

        // Store consent request
        const consentId = crypto.randomUUID();
        await supabase.from('open_banking_consents').insert({
          consent_id: consentId,
          user_id: validatedData.user_id,
          aspsp_id: validatedData.aspsp_id,
          scope: validatedData.scope,
          status: 'requested',
          redirect_uri: validatedData.redirect_uri,
          state: validatedData.state,
          created_at: new Date().toISOString(),
        });

        await logTransaction(
          validatedData.user_id,
          'authorize',
          { ...requestMetadata, ...validatedData },
          'success'
        );

        return NextResponse.json({
          consent_id: consentId,
          authorization_url: authUrl,
          expires_in: 300, // 5 minutes
        });
      }

      case 'account_info': {
        const validatedData = AccountInfoRequestSchema.parse(body);
        
        // Validate consent
        const consent = await validateConsent(validatedData.consent_id, userId);
        
        // Check SCA requirements
        const scaResult = await scaValidator.validateRequest({
          operation: 'account_info',
          userId,
          consentId: validatedData.consent_id,
        });

        if (scaResult.required && !scaResult.validated) {
          return NextResponse.json({
            sca_required: true,
            sca_methods: scaResult.methods,
            challenge_data: scaResult.challengeData,
          }, { status: 202 });
        }

        // Generate request signature
        const payload = JSON.stringify(validatedData);
        const headers = await generateRequestSignature(
          payload,
          process.env.QSEAL_KEY_ID!
        );

        // Fetch account information
        const accountInfo = await accountInfoService.getAccountInfo({
          consentId: validatedData.consent_id,
          aspspId: consent.aspsp_id,
          accountId: validatedData.account_id,
          fromDate: validatedData.from_date,
          toDate: validatedData.to_date,
          headers,
        });

        await logTransaction(
          userId,
          'account_info',
          { ...requestMetadata, ...validatedData },
          'success'
        );

        return NextResponse.json({
          accounts: accountInfo.accounts,
          transactions: accountInfo.transactions,
          balances: accountInfo.balances,
        });
      }

      case 'initiate_payment': {
        const validatedData = PaymentInitiationSchema.parse(body);
        
        // Validate consent
        const consent = await validateConsent(validatedData.consent_id, userId);
        
        // Enhanced SCA for payments
        const scaResult = await scaValidator.validateRequest({
          operation: 'payment_initiation',
          userId,
          consentId: validatedData.consent_id,
          amount: parseFloat(validatedData.instructed_amount.amount),
        });

        if (scaResult.required && !scaResult.validated) {
          return NextResponse.json({
            sca_required: true,
            sca_methods: scaResult.methods,
            challenge_data: scaResult.challengeData,
          }, { status: 202 });
        }

        // PSD2 compliance checks
        const complianceResult = await psd2Compliance.validatePayment({
          amount: parseFloat(validatedData.instructed_amount.amount),
          currency: validatedData.instructed_amount.currency,
          debtorIban: validatedData.debtor_account.iban,
          creditorIban: validatedData.creditor_account.iban,
        });

        if (!complianceResult.valid) {
          return NextResponse.json(
            { error: 'Payment validation failed', details: complianceResult.errors },
            { status: 400 }
          );
        }

        // Generate payment signature
        const payload = JSON.stringify(validatedData);
        const headers = await generateRequestSignature(
          payload,
          process.env.QSEAL_KEY_ID!
        );

        // Initiate payment
        const paymentResult = await paymentService.initiatePayment({
          ...validatedData,
          aspspId: consent.aspsp_id,
          headers,
        });

        // Store payment record
        await supabase.from('open_banking_payments').insert({
          payment_id: paymentResult.paymentId,
          consent_id: validatedData.consent_id,
          user_id: userId,
          aspsp_id: consent.aspsp_id,
          amount: validatedData.instructed_amount.amount,
          currency: validatedData.instructed_amount.currency,
          debtor_iban: validatedData.debtor_account.iban,
          creditor_iban: validatedData.creditor_account.iban,
          creditor_name: validatedData.creditor_account.name,
          status: paymentResult.status,
          created_at: new Date().toISOString(),
        });

        await logTransaction(
          userId,
          'initiate_payment',
          { ...requestMetadata, ...validatedData },
          'success'
        );

        return NextResponse.json({
          payment_id: paymentResult.paymentId,
          status: paymentResult.status,
          links: paymentResult.links,
        });
      }

      case 'consent_status': {
        const validatedData = ConsentStatusSchema.parse(body);
        
        const { data: consent } = await supabase
          .from('open_banking_consents')
          .select('*')
          .eq('consent_id', validatedData.consent_id)
          .eq('user_id', userId)
          .single();

        if (!consent) {
          return NextResponse.json(
            { error: 'Consent not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          consent_id: consent.consent_id,
          status: consent.status,
          scope: consent.scope,
          expires_at: consent.expires_at,
          created_at: consent.created_at,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Open Banking API error:', error);

    // Log error
    const userId = request.headers.get('x-user-id') || 'unknown';
    await logTransaction(
      userId,
      'error',
      { error: error.message },
      'error',
      error.message
    );

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error.message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    await limiter.check(request, 5, 'OPEN_BANKING_GET');

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const { valid, userId } = await validateApiKey(apiKey);
    if (!valid || !userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation');

    switch (operation) {
      case 'supported_banks': {
        const supportedBanks = await openBankingClient.getSupportedASPSPs();
        return NextResponse.json({ banks: supportedBanks });
      }

      case 'user_consents': {
        const { data: consents } = await supabase
          .from('open_banking_consents')
          .select('consent_id, aspsp_id, scope, status, created_at, expires_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        return NextResponse.json({ consents: consents || [] });
      }

      case 'user_payments': {
        const { data: payments } = await supabase
          .from('open_banking_payments')
          .select('payment_id, amount, currency, creditor_name, status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        return NextResponse.json({ payments: payments || [] });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Open Banking GET error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    await limiter.check(request, 2, 'OPEN_BANKING_DELETE');

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const { valid, userId } = await validateApiKey(apiKey);
    if (!valid || !userId) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const consentId = searchParams.get('consent_id');

    if (!consentId) {
      return NextResponse.json(
        { error: 'consent_id required' },
        { status: 400 }
      );
    }

    // Validate consent ownership
    const { data: consent } = await supabase
      .from('open_banking_consents')
      .select('*')
      .eq('consent_id', consentId)
      .eq('user_id', userId)
      .single();

    if (!consent) {
      return NextResponse.json(
        { error: 'Consent not found' },
        { status: 404 }
      );
    }

    // Revoke consent with ASPSP
    try {
      await openBankingClient.revokeConsent({
        consentId,
        aspspId: consent.aspsp_id,
      });
    } catch (error) {
      console.error('Failed to revoke consent with ASPSP:', error);
    }

    // Update consent status
    await supabase
      .from('open_banking_consents')
      .update({ 
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('consent_id', consentId);

    await logTransaction(
      userId,
      'revoke_consent',
      { consent_id: consentId },
      'success'
    );

    return NextResponse.json({ 
      message: 'Consent revoked successfully',
      consent_id: consentId,
    });
  } catch (error: any) {
    console.error('Open Banking DELETE error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}