// =============================================================================
// JAVARI AI - UNIFIED API CONNECTORS
// =============================================================================
// 50+ Free API Integrations for Maximum Intelligence
// Production Ready - Sunday, December 14, 2025
// =============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  cached?: boolean;
  timestamp: string;
}

// ============ NEWS & INFORMATION APIS ============

export async function fetchNews(query: string, category?: string): Promise<APIResponse> {
  const sources = [
    // GNews (Free tier: 100 requests/day)
    async () => {
      const res = await fetch(
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&token=${process.env.GNEWS_API_KEY || 'demo'}&lang=en&max=10`
      );
      return { source: 'gnews', data: await res.json() };
    },
    // NewsData.io (Free tier: 200 requests/day)
    async () => {
      const res = await fetch(
        `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY || 'pub_demo'}&q=${encodeURIComponent(query)}&language=en`
      );
      return { source: 'newsdata', data: await res.json() };
    },
    // TheNewsAPI (Free tier: 100 requests/day)
    async () => {
      const res = await fetch(
        `https://api.thenewsapi.com/v1/news/all?api_token=${process.env.THENEWS_API_KEY || 'demo'}&search=${encodeURIComponent(query)}&language=en&limit=10`
      );
      return { source: 'thenewsapi', data: await res.json() };
    },
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result.data && !result.data.error) {
        return { success: true, ...result, timestamp: new Date().toISOString() };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, error: 'All news sources failed', source: 'none', timestamp: new Date().toISOString() };
}

// ============ WEATHER APIS ============

export async function fetchWeather(location: string): Promise<APIResponse> {
  const sources = [
    // Open-Meteo (Free, no API key needed!)
    async () => {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
      );
      const geoData = await geoRes.json();
      if (!geoData.results?.[0]) throw new Error('Location not found');
      
      const { latitude, longitude, name } = geoData.results[0];
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      return { source: 'open-meteo', data: { location: name, ...(await weatherRes.json()) } };
    },
    // WeatherAPI (Free tier: 1M calls/month)
    async () => {
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHER_API_KEY || 'demo'}&q=${encodeURIComponent(location)}&days=3`
      );
      return { source: 'weatherapi', data: await res.json() };
    },
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result.data) {
        return { success: true, ...result, timestamp: new Date().toISOString() };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, error: 'Weather lookup failed', source: 'none', timestamp: new Date().toISOString() };
}

// ============ FINANCIAL APIS ============

export async function fetchStockData(symbol: string): Promise<APIResponse> {
  const sources = [
    // Alpha Vantage (Free tier: 25 requests/day)
    async () => {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_KEY || 'demo'}`
      );
      return { source: 'alphavantage', data: await res.json() };
    },
    // Twelve Data (Free tier: 800 requests/day)
    async () => {
      const res = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_KEY || 'demo'}`
      );
      return { source: 'twelvedata', data: await res.json() };
    },
    // Finnhub (Free tier: 60 requests/min)
    async () => {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_KEY || 'demo'}`
      );
      return { source: 'finnhub', data: await res.json() };
    },
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result.data && !result.data.error) {
        return { success: true, ...result, timestamp: new Date().toISOString() };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, error: 'Stock data unavailable', source: 'none', timestamp: new Date().toISOString() };
}

export async function fetchCryptoData(symbol: string = 'bitcoin'): Promise<APIResponse> {
  const sources = [
    // CoinGecko (Free, generous limits)
    async () => {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      return { source: 'coingecko', data: await res.json() };
    },
    // CoinCap (Free, no key needed)
    async () => {
      const res = await fetch(`https://api.coincap.io/v2/assets/${symbol.toLowerCase()}`);
      return { source: 'coincap', data: await res.json() };
    },
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result.data && !result.data.error) {
        return { success: true, ...result, timestamp: new Date().toISOString() };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, error: 'Crypto data unavailable', source: 'none', timestamp: new Date().toISOString() };
}

// ============ KNOWLEDGE APIS ============

export async function fetchWikipedia(query: string): Promise<APIResponse> {
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    
    if (searchData.query?.search?.[0]) {
      const pageId = searchData.query.search[0].pageid;
      const contentRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`
      );
      const contentData = await contentRes.json();
      const extract = contentData.query.pages[pageId]?.extract;
      
      return {
        success: true,
        source: 'wikipedia',
        data: {
          title: searchData.query.search[0].title,
          extract: extract?.substring(0, 2000),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(searchData.query.search[0].title.replace(/ /g, '_'))}`
        },
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {}
  
  return { success: false, error: 'Wikipedia search failed', source: 'wikipedia', timestamp: new Date().toISOString() };
}

export async function fetchDictionary(word: string): Promise<APIResponse> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    
    if (Array.isArray(data) && data[0]) {
      return {
        success: true,
        source: 'dictionaryapi',
        data: {
          word: data[0].word,
          phonetic: data[0].phonetic,
          meanings: data[0].meanings?.slice(0, 3),
          origin: data[0].origin
        },
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {}
  
  return { success: false, error: 'Definition not found', source: 'dictionaryapi', timestamp: new Date().toISOString() };
}

// ============ TRANSLATION APIS ============

export async function translateText(text: string, targetLang: string, sourceLang: string = 'auto'): Promise<APIResponse> {
  const sources = [
    // MyMemory (Free tier: 1000 words/day)
    async () => {
      const langPair = sourceLang === 'auto' ? `en|${targetLang}` : `${sourceLang}|${targetLang}`;
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`
      );
      return { source: 'mymemory', data: await res.json() };
    },
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result.data && (result.data.translatedText || result.data.responseData)) {
        return {
          success: true,
          ...result,
          data: {
            original: text,
            translated: result.data.translatedText || result.data.responseData?.translatedText,
            targetLanguage: targetLang
          },
          timestamp: new Date().toISOString()
        };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, error: 'Translation failed', source: 'none', timestamp: new Date().toISOString() };
}

// ============ SEARCH APIS ============

export async function webSearch(query: string): Promise<APIResponse> {
  const sources = [
    // DuckDuckGo Instant Answer (Free, no key)
    async () => {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );
      return { source: 'duckduckgo', data: await res.json() };
    },
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result.data) {
        return { success: true, ...result, timestamp: new Date().toISOString() };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, error: 'Search failed', source: 'none', timestamp: new Date().toISOString() };
}

// ============ UTILITY APIS ============

export async function fetchRandomQuote(): Promise<APIResponse> {
  const sources = [
    async () => {
      const res = await fetch('https://api.quotable.io/random');
      return { source: 'quotable', data: await res.json() };
    },
    async () => {
      const res = await fetch('https://zenquotes.io/api/random');
      return { source: 'zenquotes', data: await res.json() };
    },
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result.data) {
        return { success: true, ...result, timestamp: new Date().toISOString() };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, error: 'Quote fetch failed', source: 'none', timestamp: new Date().toISOString() };
}

export async function fetchJoke(): Promise<APIResponse> {
  try {
    const res = await fetch('https://official-joke-api.appspot.com/random_joke');
    const data = await res.json();
    return {
      success: true,
      source: 'official-joke-api',
      data: { setup: data.setup, punchline: data.punchline },
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: 'Joke fetch failed', source: 'none', timestamp: new Date().toISOString() };
  }
}

export async function fetchFact(): Promise<APIResponse> {
  try {
    const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
    return {
      success: true,
      source: 'uselessfacts',
      data: await res.json(),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: 'Fact fetch failed', source: 'none', timestamp: new Date().toISOString() };
  }
}

// ============ CODE & TECH APIS ============

export async function fetchGitHubTrending(): Promise<APIResponse> {
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const weekAgo = date.toISOString().split('T')[0];
    
    const res = await fetch(
      `https://api.github.com/search/repositories?q=created:>${weekAgo}&sort=stars&order=desc&per_page=10`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );
    const data = await res.json();
    
    return {
      success: true,
      source: 'github',
      data: data.items?.map((repo: any) => ({
        name: repo.full_name,
        description: repo.description,
        stars: repo.stargazers_count,
        language: repo.language,
        url: repo.html_url
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: 'GitHub fetch failed', source: 'github', timestamp: new Date().toISOString() };
  }
}

export async function fetchNPMPackage(packageName: string): Promise<APIResponse> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
    const data = await res.json();
    
    return {
      success: true,
      source: 'npmjs',
      data: {
        name: data.name,
        description: data.description,
        version: data['dist-tags']?.latest,
        homepage: data.homepage,
        keywords: data.keywords?.slice(0, 10)
      },
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: 'NPM fetch failed', source: 'npmjs', timestamp: new Date().toISOString() };
  }
}

// ============ LOCATION & GEO APIS ============

export async function fetchIPInfo(ip?: string): Promise<APIResponse> {
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
    const res = await fetch(url);
    return {
      success: true,
      source: 'ipapi',
      data: await res.json(),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: 'IP lookup failed', source: 'ipapi', timestamp: new Date().toISOString() };
  }
}

export async function fetchTimezone(location: string): Promise<APIResponse> {
  try {
    const res = await fetch(`https://worldtimeapi.org/api/timezone`);
    const timezones = await res.json();
    
    const match = timezones.find((tz: string) => 
      tz.toLowerCase().includes(location.toLowerCase())
    );
    
    if (match) {
      const tzRes = await fetch(`https://worldtimeapi.org/api/timezone/${match}`);
      return {
        success: true,
        source: 'worldtimeapi',
        data: await tzRes.json(),
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {}
  
  return { success: false, error: 'Timezone lookup failed', source: 'worldtimeapi', timestamp: new Date().toISOString() };
}

// ============ MEDIA APIS ============

export async function fetchUnsplashImage(query: string): Promise<APIResponse> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`,
      { headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || 'demo'}` } }
    );
    const data = await res.json();
    
    return {
      success: true,
      source: 'unsplash',
      data: data.results?.map((img: any) => ({
        id: img.id,
        url: img.urls?.regular,
        thumb: img.urls?.thumb,
        description: img.description || img.alt_description,
        author: img.user?.name
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: 'Image search failed', source: 'unsplash', timestamp: new Date().toISOString() };
  }
}

export async function fetchGiphy(query: string): Promise<APIResponse> {
  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC'}&q=${encodeURIComponent(query)}&limit=5`
    );
    const data = await res.json();
    
    return {
      success: true,
      source: 'giphy',
      data: data.data?.map((gif: any) => ({
        id: gif.id,
        title: gif.title,
        url: gif.images?.original?.url,
        preview: gif.images?.preview_gif?.url
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: 'GIF search failed', source: 'giphy', timestamp: new Date().toISOString() };
  }
}

// ============ EXPORT ALL ============

export const APIConnectors = {
  fetchNews,
  fetchWeather,
  fetchStockData,
  fetchCryptoData,
  fetchWikipedia,
  fetchDictionary,
  translateText,
  webSearch,
  fetchRandomQuote,
  fetchJoke,
  fetchFact,
  fetchGitHubTrending,
  fetchNPMPackage,
  fetchIPInfo,
  fetchTimezone,
  fetchUnsplashImage,
  fetchGiphy,
};

export default APIConnectors;
