/**
 * JAVARI AI - ULTIMATE API HUB ROUTE HANDLER
 * Only exports: GET, POST (valid Next.js route exports)
 * All utilities moved to lib/hub-api-utils.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import * as HubAPI from '@/lib/hub-api-utils';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { action, query, params } = await request.json();
    
    let result: HubAPI.APIResult;
    
    switch (action) {
      case 'weather':
        result = await HubAPI.getWeather(query || params?.location || 'New York');
        break;
      case 'news':
        result = await HubAPI.getNews(query || 'technology', params?.category);
        break;
      case 'stock':
        result = await HubAPI.getStock(query || params?.symbol || 'AAPL');
        break;
      case 'crypto':
        result = await HubAPI.getCrypto(query || params?.symbol || 'bitcoin');
        break;
      case 'wikipedia':
      case 'wiki':
        result = await HubAPI.getWikipedia(query || '');
        break;
      case 'dictionary':
      case 'define':
        result = await HubAPI.getDictionary(query || params?.word || '');
        break;
      case 'translate':
        result = await HubAPI.translate(query || params?.text || '', params?.target || 'es', params?.source || 'en');
        break;
      case 'github':
      case 'trending':
        result = await HubAPI.getGitHubTrending(params?.language);
        break;
      case 'npm':
        result = await HubAPI.getNPMPackage(query || params?.package || '');
        break;
      case 'joke':
        result = await HubAPI.getJoke();
        break;
      case 'quote':
        result = await HubAPI.getQuote();
        break;
      case 'fact':
        result = await HubAPI.getFact();
        break;
      case 'trivia':
        result = await HubAPI.getTrivia(params?.category);
        break;
      case 'images':
        result = await HubAPI.searchImages(query || '');
        break;
      case 'gifs':
        result = await HubAPI.searchGifs(query || '');
        break;
      case 'ip':
      case 'geolocation':
        result = await HubAPI.getIPInfo(query || params?.ip);
        break;
      case 'timezone':
        result = await HubAPI.getTimezone(query || params?.location || 'America/New_York');
        break;
      case 'exchange':
      case 'forex':
        result = await HubAPI.getExchangeRates(query || params?.base || 'USD');
        break;
      case 'url':
      case 'metadata':
        result = await HubAPI.getURLMetadata(query || params?.url || '');
        break;
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          available_actions: [
            'weather', 'news', 'stock', 'crypto', 'wikipedia', 'dictionary',
            'translate', 'github', 'npm', 'joke', 'quote', 'fact', 'trivia',
            'images', 'gifs', 'ip', 'timezone', 'exchange', 'url'
          ]
        }, { status: 400 });
    }
    
    return NextResponse.json({
      ...result,
      action,
      query,
      total_latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'API request failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Javari Ultimate API Hub',
    version: '3.0.0',
    description: '75+ Free API integrations for maximum intelligence',
    categories: {
      weather: ['open-meteo', 'weatherapi'],
      news: ['gnews', 'newsdata', 'currents'],
      finance: ['finnhub', 'alphavantage', 'twelvedata', 'polygon'],
      crypto: ['coingecko', 'coincap', 'coinpaprika'],
      knowledge: ['wikipedia', 'dictionaryapi'],
      translation: ['mymemory', 'libretranslate'],
      development: ['github', 'npm'],
      entertainment: ['jokes', 'quotes', 'facts', 'trivia'],
      media: ['unsplash', 'pexels', 'giphy'],
      utility: ['ipapi', 'worldtimeapi', 'exchangerate', 'microlink']
    },
    actions: [
      'weather', 'news', 'stock', 'crypto', 'wikipedia', 'dictionary',
      'translate', 'github', 'npm', 'joke', 'quote', 'fact', 'trivia',
      'images', 'gifs', 'ip', 'timezone', 'exchange', 'url'
    ],
    timestamp: new Date().toISOString()
  });
}
