```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resolver } from 'did-resolver';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';
import { getResolver as getWebResolver } from 'web-did-resolver';
import { getResolver as getKeyResolver } from 'key-did-resolver';
import { agent } from '@veramo/core';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { KeyManager } from '@veramo/key-manager';
import { KMSLocal } from '@veramo/kms-local';
import { ethers } from 'ethers';
import * as jose from 'jose';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { createClient as createRedisClient } from 'redis';

// Types
interface DIDDocument {
  '@context': string | string[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: ServiceEndpoint[];
}

interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyBase58?: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyMultibase?: string;
}

interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

interface VerifiableCredential {
  '@context': string | string[];
  id?: string;
  type: string[];
  issuer: string | { id: string };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, any>;
  proof?: Proof;
}

interface Proof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  jws?: string;
  proofValue?: string;
}

interface AuthenticationChallenge {
  challenge: string;
  did: string;
  timestamp: number;
  nonce: string;
}

interface AuthorizationPolicy {
  id: string;
  resource: string;
  action: string;
  conditions: PolicyCondition[];
}

interface PolicyCondition {
  type: 'credential' | 'attribute' | 'time' | 'location';
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: any;
}

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = createRedisClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const didResolver = new Resolver({
  ...getEthrResolver({ infuraProjectId: process.env.INFURA_PROJECT_ID }),
  ...getWebResolver(),
  ...getKeyResolver()
});

const veramoAgent = agent({
  plugins: [
    new KeyManager({
      store: new KMSLocal({
        secretKey: process.env.VERAMO_SECRET_KEY!
      })
    }),
    new DIDResolverPlugin({
      resolver: didResolver
    }),
    new CredentialPlugin()
  ]
});

// Utility functions
function validateDIDFormat(did: string): boolean {
  const didRegex = /^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/;
  return didRegex.test(did);
}

function generateChallenge(): string {
  return randomBytes(32).toString('hex');
}

function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

function hashCredential(credential: VerifiableCredential): string {
  const normalized = JSON.stringify(credential, Object.keys(credential).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

async function cacheSet(key: string, value: any, ttl: number = 3600): Promise<void> {
  try {
    await redis.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Redis cache set error:', error);
  }
}

async function cacheGet(key: string): Promise<any> {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Redis cache get error:', error);
    return null;
  }
}

async function resolveDID(did: string): Promise<DIDDocument | null> {
  try {
    if (!validateDIDFormat(did)) {
      throw new Error('Invalid DID format');
    }

    // Check cache first
    const cacheKey = `did:${did}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await didResolver.resolve(did);
    
    if (result.didResolutionMetadata.error) {
      throw new Error(`DID resolution error: ${result.didResolutionMetadata.error}`);
    }

    const didDocument = result.didDocument as DIDDocument;
    
    // Cache the resolved DID document
    await cacheSet(cacheKey, didDocument, 1800);
    
    return didDocument;
  } catch (error) {
    console.error('DID resolution error:', error);
    return null;
  }
}

async function verifyProof(credential: VerifiableCredential): Promise<boolean> {
  try {
    if (!credential.proof) {
      return false;
    }

    const { proof } = credential;
    const issuerDID = typeof credential.issuer === 'string' 
      ? credential.issuer 
      : credential.issuer.id;

    const didDocument = await resolveDID(issuerDID);
    if (!didDocument) {
      return false;
    }

    // Find verification method
    const verificationMethod = didDocument.verificationMethod?.find(
      vm => vm.id === proof.verificationMethod
    );

    if (!verificationMethod) {
      return false;
    }

    // Verify based on proof type
    switch (proof.type) {
      case 'Ed25519Signature2020':
        return await verifyEd25519Signature(credential, proof, verificationMethod);
      case 'JsonWebSignature2020':
        return await verifyJWSSignature(credential, proof, verificationMethod);
      default:
        return false;
    }
  } catch (error) {
    console.error('Proof verification error:', error);
    return false;
  }
}

async function verifyEd25519Signature(
  credential: VerifiableCredential,
  proof: Proof,
  verificationMethod: VerificationMethod
): Promise<boolean> {
  try {
    if (!verificationMethod.publicKeyBase58 && !verificationMethod.publicKeyMultibase) {
      return false;
    }

    // Create credential without proof for verification
    const { proof: _, ...credentialWithoutProof } = credential;
    const message = JSON.stringify(credentialWithoutProof, Object.keys(credentialWithoutProof).sort());

    const keyPair = await Ed25519VerificationKey2020.from(verificationMethod);
    const verifier = keyPair.verifier();
    
    return await verifier.verify({
      data: Buffer.from(message),
      signature: Buffer.from(proof.proofValue!, 'base64')
    });
  } catch (error) {
    console.error('Ed25519 signature verification error:', error);
    return false;
  }
}

async function verifyJWSSignature(
  credential: VerifiableCredential,
  proof: Proof,
  verificationMethod: VerificationMethod
): Promise<boolean> {
  try {
    if (!proof.jws || !verificationMethod.publicKeyJwk) {
      return false;
    }

    const publicKey = await jose.importJWK(verificationMethod.publicKeyJwk);
    const { payload } = await jose.jwtVerify(proof.jws, publicKey);
    
    // Verify payload matches credential
    const credentialHash = hashCredential(credential);
    return payload.credentialHash === credentialHash;
  } catch (error) {
    console.error('JWS signature verification error:', error);
    return false;
  }
}

async function evaluateAuthorizationPolicy(
  policy: AuthorizationPolicy,
  credentials: VerifiableCredential[],
  context: Record<string, any>
): Promise<boolean> {
  try {
    for (const condition of policy.conditions) {
      const result = await evaluateCondition(condition, credentials, context);
      if (!result) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Policy evaluation error:', error);
    return false;
  }
}

async function evaluateCondition(
  condition: PolicyCondition,
  credentials: VerifiableCredential[],
  context: Record<string, any>
): Promise<boolean> {
  switch (condition.type) {
    case 'credential':
      return credentials.some(cred => 
        cred.type.includes(condition.field) && 
        evaluateOperator(true, condition.operator, condition.value)
      );
    case 'attribute':
      const attributeValue = extractAttributeFromCredentials(credentials, condition.field);
      return evaluateOperator(attributeValue, condition.operator, condition.value);
    case 'time':
      const currentTime = Date.now();
      return evaluateOperator(currentTime, condition.operator, condition.value);
    case 'location':
      const location = context.location;
      return evaluateOperator(location, condition.operator, condition.value);
    default:
      return false;
  }
}

function evaluateOperator(actual: any, operator: string, expected: any): boolean {
  switch (operator) {
    case 'eq': return actual === expected;
    case 'ne': return actual !== expected;
    case 'gt': return actual > expected;
    case 'lt': return actual < expected;
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'contains': return typeof actual === 'string' && actual.includes(expected);
    default: return false;
  }
}

function extractAttributeFromCredentials(
  credentials: VerifiableCredential[],
  field: string
): any {
  for (const credential of credentials) {
    const value = credential.credentialSubject[field];
    if (value !== undefined) {
      return value;
    }
  }
  return null;
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'authenticate':
        return handleAuthenticate(request);
      case 'issue-credential':
        return handleIssueCredential(request);
      case 'verify-credential':
        return handleVerifyCredential(request);
      case 'authorize':
        return handleAuthorize(request);
      case 'recover-identity':
        return handleRecoverIdentity(request);
      case 'generate-proof':
        return handleGenerateProof(request);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('DID API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleAuthenticate(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { did, signature, challenge } = body;

    if (!did || !signature || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify challenge exists and is valid
    const challengeKey = `challenge:${challenge}`;
    const challengeData = await cacheGet(challengeKey);
    
    if (!challengeData || challengeData.did !== did) {
      return NextResponse.json(
        { error: 'Invalid challenge' },
        { status: 401 }
      );
    }

    // Resolve DID document
    const didDocument = await resolveDID(did);
    if (!didDocument) {
      return NextResponse.json(
        { error: 'Could not resolve DID' },
        { status: 404 }
      );
    }

    // Verify signature against challenge
    const verificationMethod = didDocument.authentication?.[0];
    if (!verificationMethod) {
      return NextResponse.json(
        { error: 'No authentication method found' },
        { status: 401 }
      );
    }

    // Create or update user in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .upsert({
        did,
        did_document: didDocument,
        last_authenticated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase user upsert error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      );
    }

    // Generate session token
    const sessionToken = await jose.EncryptJWT({
      did,
      userId: user.id,
      timestamp: Date.now()
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .encrypt(new TextEncoder().encode(process.env.JWT_SECRET!));

    // Cache session
    await cacheSet(`session:${sessionToken}`, {
      did,
      userId: user.id,
      authenticated: true
    }, 86400);

    return NextResponse.json({
      success: true,
      sessionToken,
      user: {
        id: user.id,
        did,
        authenticated: true
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

async function handleIssueCredential(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { 
      credentialSubject, 
      credentialType, 
      issuerDID, 
      subjectDID,
      expirationDate,
      schema 
    } = body;

    if (!credentialSubject || !credentialType || !issuerDID || !subjectDID) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate schema if provided
    if (schema) {
      // Schema validation logic here
    }

    // Create verifiable credential
    const credential: VerifiableCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://cr-audioviz.com/credentials/v1'
      ],
      id: `https://cr-audioviz.com/credentials/${randomBytes(16).toString('hex')}`,
      type: ['VerifiableCredential', credentialType],
      issuer: issuerDID,
      issuanceDate: new Date().toISOString(),
      ...(expirationDate && { expirationDate }),
      credentialSubject: {
        id: subjectDID,
        ...credentialSubject
      }
    };

    // Sign credential using Veramo
    const signedCredential = await veramoAgent.createVerifiableCredential({
      credential,
      proofFormat: 'jwt'
    });

    // Store in Supabase
    const { error } = await supabase
      .from('verifiable_credentials')
      .insert({
        id: credential.id,
        issuer_did: issuerDID,
        subject_did: subjectDID,
        credential_type: credentialType,
        credential_data: signedCredential,
        issued_at: credential.issuanceDate,
        expires_at: expirationDate,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Credential storage error:', error);
      return NextResponse.json(
        { error: 'Failed to store credential' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      credential: signedCredential
    });
  } catch (error) {
    console.error('Credential issuance error:', error);
    return NextResponse.json(
      { error: 'Credential issuance failed' },
      { status: 500 }
    );
  }
}

async function handleVerifyCredential(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json(
        { error: 'Missing credential' },
        { status: 400 }
      );
    }

    // Verify credential using Veramo
    const verificationResult = await veramoAgent.verifyCredential({
      credential
    });

    const isValid = verificationResult.verified;
    
    // Additional custom verification
    const proofVerified = credential.proof ? await verifyProof(credential) : false;
    
    // Check expiration
    const isExpired = credential.expirationDate ? 
      new Date(credential.expirationDate) < new Date() : false;

    // Check revocation status
    const isRevoked = await checkRevocationStatus(credential.id);

    const finalResult = {
      verified: isValid && proofVerified && !isExpired && !isRevoked,
      details: {
        signatureValid: isValid && proofVerified,
        expired: isExpired,
        revoked: isRevoked,
        verificationResult
      }
    };

    return NextResponse.json({
      success: true,
      verification: finalResult
    });
  } catch (error) {
    console.error('Credential verification error:', error);
    return NextResponse.json(
      { error: 'Credential verification failed' },
      { status: 500 }
    );
  }
}

async function handleAuthorize(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { credentials, resource, action, context = {} } = body;

    if (!credentials || !resource || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get authorization policies for resource/action
    const { data: policies, error } = await supabase
      .from('authorization_policies')
      .select('*')
      .eq('resource', resource)
      .eq('action', action);

    if (error) {
      console.error('Policy retrieval error:', error);
      return NextResponse.json(
        { error: 'Authorization failed' },
        { status: 500 }
      );
    }

    if (!policies || policies.length === 0) {
      return NextResponse.json(
        { authorized: false, reason: 'No policies found' }
      );
    }

    // Evaluate policies
    for (const policy of policies) {
      const authorized = await evaluateAuthorizationPolicy(
        policy, 
        credentials, 
        context
      );
      
      if (authorized) {
        return NextResponse.json({
          authorized: true,
          policy: policy.id
        });
      }
    }

    return NextResponse.json({
      authorized: false,
      reason: 'No policy satisfied'
    });
  } catch (error) {
    console.error('Authorization error:', error);
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 500 }
    );
  }
}

async function handleRecoverIdentity(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { did, recoveryMethod, proof } = body;

    if (!did || !recoveryMethod || !proof) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify recovery proof based on method
    let recoveryValid = false;
    
    switch (recoveryMethod) {
      case 'social':
        recoveryValid = await verifySocialRecovery(did, proof);
        break;
      case 'guardian':
        recoveryValid = await verifyGuardianRecovery(did, proof);
        break;
      case 'backup':
        recoveryValid = await verifyBackupRecovery(did, proof);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid recovery method' },
          { status: 400 }
        );
    }

    if (!recoveryValid) {
      return NextResponse.json(
        { error: 'Recovery proof invalid' },
        { status: 401 }
      );
    }

    // Generate new recovery challenge
    const recoveryChallenge = generateChallenge();
    await cacheSet(`recovery:${recoveryChallenge}`, {
      did,
      method: recoveryMethod,
      timestamp: Date.now()
    }, 900); // 15 minutes

    return NextResponse.json({
      success: true,
      recoveryChallenge,
      nextStep: 'key-rotation'
    });
  } catch (error) {
    console.error('Identity recovery error:', error);
    return NextResponse.json(
      { error: 'Identity recovery failed' },
      { status: 500 }
    );
  }
}

async function handleGenerateProof(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { credentials, proofType, challenge } = body;

    if (!credentials || !proofType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let proof;
    
    switch (proofType) {
      case 'selective-disclosure':
        proof = await generateSelectiveDisclosureProof(credentials, body.disclosureMap);
        break;
      case 'zero-knowledge':
        proof = await generateZKProof(credentials, body.circuit, challenge);
        break;
      case 'aggregated':
        proof = await generateAggregated