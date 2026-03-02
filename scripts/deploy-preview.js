#!/usr/bin/env node
/**
 * deploy-preview.js
 * Trigger Vercel preview deployment
 * Usage: node scripts/deploy-preview.js
 * Date: 2025-03-01
 */

const https = require('https');

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || 'QnvXSY3ASR6wBw1Te3juBTFJ';
const TEAM_ID = 'team_Z0yef7NlFu1coCJWz8UmUdI5';
const PROJECT_ID = 'prj_zxjzE2qvMWFWqV0AspGvago6aPV5';

async function deploy() {
  console.log('🚀 Triggering Vercel preview deployment...');
  
  const deployBody = JSON.stringify({
    name: 'javari-ai',
    gitSource: {
      type: 'github',
      org: 'CR-AudioViz-AI',
      repo: 'javari-ai',
      ref: 'main'
    },
    target: 'preview',
    projectSettings: {
      framework: 'nextjs'
    }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      path: `/v13/deployments?teamId=${TEAM_ID}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(deployBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✓ Deployment triggered successfully');
            console.log('📋 Deployment ID:', parsed.id);
            console.log('🌐 URL:', `https://${parsed.url}`);
            console.log('🔍 Inspect:', parsed.inspectorUrl);
            resolve(parsed);
          } else {
            console.error('✗ Deployment failed:', res.statusCode);
            console.error('Response:', data);
            reject(new Error(`Deployment failed: ${res.statusCode}`));
          }
        } catch (err) {
          console.error('✗ Parse error:', err.message);
          console.error('Raw response:', data);
          reject(err);
        }
      });
    });

    req.on('error', (e) => {
      console.error('✗ Request error:', e.message);
      reject(e);
    });

    req.write(deployBody);
    req.end();
  });
}

deploy().catch((err) => {
  console.error('Deployment failed:', err.message);
  process.exit(1);
});
