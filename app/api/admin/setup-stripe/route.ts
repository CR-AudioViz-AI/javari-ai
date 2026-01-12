import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

// This API creates the subscription products - run once then disable
export async function POST(request: NextRequest) {
  // Security: Check for admin secret
  const { secret } = await request.json();
  if (secret !== process.env.ADMIN_SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const results: any = { products: [], prices: [] };
    
    // Check if products already exist
    const existingProducts = await stripe.products.list({ limit: 100 });
    const creatorExists = existingProducts.data.find(p => p.name.includes('Creator Annual'));
    const proExists = existingProducts.data.find(p => p.name.includes('Pro Annual'));
    
    // Create Creator Annual Product
    let creatorProduct, creatorPrice;
    if (!creatorExists) {
      creatorProduct = await stripe.products.create({
        name: 'Javari Library Creator Annual',
        description: 'Full access to 300+ professional eBooks, 1,000 credits/month, audiobook streaming, 50% off conversions',
        metadata: { type: 'subscription', tier: 'creator' }
      });
      
      creatorPrice = await stripe.prices.create({
        product: creatorProduct.id,
        unit_amount: 19900, // $199
        currency: 'usd',
        recurring: { interval: 'year' },
        metadata: { tier: 'creator' }
      });
      
      results.products.push({ name: 'Creator Annual', id: creatorProduct.id });
      results.prices.push({ name: 'Creator Annual', id: creatorPrice.id, amount: '$199/year' });
    } else {
      results.products.push({ name: 'Creator Annual', id: creatorExists.id, status: 'already exists' });
    }
    
    // Create Pro Annual Product
    let proProduct, proPrice;
    if (!proExists) {
      proProduct = await stripe.products.create({
        name: 'Javari Library Pro Annual',
        description: 'Everything in Creator plus source files, commercial license, 5,000 credits/month, API access, white-label rights',
        metadata: { type: 'subscription', tier: 'pro' }
      });
      
      proPrice = await stripe.prices.create({
        product: proProduct.id,
        unit_amount: 49900, // $499
        currency: 'usd',
        recurring: { interval: 'year' },
        metadata: { tier: 'pro' }
      });
      
      results.products.push({ name: 'Pro Annual', id: proProduct.id });
      results.prices.push({ name: 'Pro Annual', id: proPrice.id, amount: '$499/year' });
    } else {
      results.products.push({ name: 'Pro Annual', id: proExists.id, status: 'already exists' });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Stripe products configured',
      results,
      instructions: 'Add these price IDs to Vercel env vars: STRIPE_CREATOR_PRICE_ID and STRIPE_PRO_PRICE_ID'
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ 
      error: 'Setup failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
