// lib/services/media-services.ts
// Centralized Media Services for CR AudioViz AI Ecosystem
// Created: December 28, 2025
// Integrates: ImageKit, api.video, Shotstack, Pixabay

// ============ IMAGEKIT (Image CDN & Transformations) ============
export const IMAGEKIT_CONFIG = {
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/craudiovizai'
};

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'maintain_ratio' | 'force' | 'at_max' | 'at_least';
  focus?: 'auto' | 'face' | 'center';
}

export function getOptimizedImageUrl(
  path: string, 
  options: ImageTransformOptions = {}
): string {
  const { width, height, quality = 80, format = 'auto', crop, focus } = options;
  
  const transforms: string[] = [];
  
  if (width) transforms.push(`w-${width}`);
  if (height) transforms.push(`h-${height}`);
  if (quality !== 80) transforms.push(`q-${quality}`);
  if (format !== 'auto') transforms.push(`f-${format}`);
  if (crop) transforms.push(`c-${crop}`);
  if (focus) transforms.push(`fo-${focus}`);
  
  const transformString = transforms.length > 0 ? `tr:${transforms.join(',')}` : '';
  
  return `${IMAGEKIT_CONFIG.urlEndpoint}/${transformString}/${path}`.replace('//', '/');
}

// ============ API.VIDEO (Video Hosting & Encoding) ============
export const API_VIDEO_CONFIG = {
  apiKey: process.env.API_VIDEO_API_KEY || '',
  baseUrl: process.env.API_VIDEO_BASE_URL || 'https://ws.api.video'
};

export interface VideoUploadOptions {
  title: string;
  description?: string;
  public?: boolean;
  mp4Support?: boolean;
}

export async function uploadVideo(
  file: File | Blob,
  options: VideoUploadOptions
): Promise<{ videoId: string; playerUrl: string; thumbnailUrl: string } | null> {
  try {
    // Step 1: Create video object
    const createResponse = await fetch(`${API_VIDEO_CONFIG.baseUrl}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_VIDEO_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        public: options.public ?? true,
        mp4Support: options.mp4Support ?? true
      })
    });
    
    const videoData = await createResponse.json();
    const videoId = videoData.videoId;
    
    // Step 2: Upload the video file
    const formData = new FormData();
    formData.append('file', file);
    
    await fetch(`${API_VIDEO_CONFIG.baseUrl}/videos/${videoId}/source`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_VIDEO_CONFIG.apiKey}`
      },
      body: formData
    });
    
    return {
      videoId,
      playerUrl: `https://embed.api.video/vod/${videoId}`,
      thumbnailUrl: videoData.assets?.thumbnail || ''
    };
  } catch (error) {
    console.error('Video upload error:', error);
    return null;
  }
}

// ============ SHOTSTACK (Video Automation) ============
export const SHOTSTACK_CONFIG = {
  sandboxApiKey: process.env.SHOTSTACK_SANDBOX_API_KEY || '',
  productionApiKey: process.env.SHOTSTACK_PRODUCTION_API_KEY || '',
  baseUrl: 'https://api.shotstack.io/v1'
};

export interface ShotstackTemplate {
  name: string;
  timeline: any; // Shotstack timeline JSON
}

export async function renderVideo(
  template: ShotstackTemplate,
  useSandbox: boolean = true
): Promise<{ renderId: string; status: string } | null> {
  const apiKey = useSandbox 
    ? SHOTSTACK_CONFIG.sandboxApiKey 
    : SHOTSTACK_CONFIG.productionApiKey;
  
  try {
    const response = await fetch(`${SHOTSTACK_CONFIG.baseUrl}/render`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeline: template.timeline,
        output: {
          format: 'mp4',
          resolution: 'hd'
        }
      })
    });
    
    const data = await response.json();
    return {
      renderId: data.response?.id || '',
      status: data.response?.status || 'queued'
    };
  } catch (error) {
    console.error('Shotstack render error:', error);
    return null;
  }
}

// ============ PIXABAY (Stock Media) ============
export const PIXABAY_CONFIG = {
  apiKey: process.env.PIXABAY_API_KEY || '',
  baseUrl: 'https://pixabay.com/api'
};

export interface PixabaySearchOptions {
  query: string;
  type?: 'photo' | 'illustration' | 'vector' | 'all';
  orientation?: 'all' | 'horizontal' | 'vertical';
  category?: string;
  minWidth?: number;
  minHeight?: number;
  safeSearch?: boolean;
  perPage?: number;
  page?: number;
}

export interface PixabayImage {
  id: number;
  webformatURL: string;
  largeImageURL: string;
  fullHDURL?: string;
  imageWidth: number;
  imageHeight: number;
  tags: string;
  user: string;
}

export async function searchImages(
  options: PixabaySearchOptions
): Promise<{ images: PixabayImage[]; total: number }> {
  const params = new URLSearchParams({
    key: PIXABAY_CONFIG.apiKey,
    q: options.query,
    image_type: options.type || 'all',
    orientation: options.orientation || 'all',
    safesearch: String(options.safeSearch ?? true),
    per_page: String(options.perPage || 20),
    page: String(options.page || 1)
  });
  
  if (options.category) params.append('category', options.category);
  if (options.minWidth) params.append('min_width', String(options.minWidth));
  if (options.minHeight) params.append('min_height', String(options.minHeight));
  
  try {
    const response = await fetch(`${PIXABAY_CONFIG.baseUrl}/?${params}`);
    const data = await response.json();
    
    return {
      images: data.hits || [],
      total: data.totalHits || 0
    };
  } catch (error) {
    console.error('Pixabay search error:', error);
    return { images: [], total: 0 };
  }
}

export async function searchVideos(query: string, perPage: number = 10) {
  const params = new URLSearchParams({
    key: PIXABAY_CONFIG.apiKey,
    q: query,
    safesearch: 'true',
    per_page: String(perPage)
  });
  
  try {
    const response = await fetch(`${PIXABAY_CONFIG.baseUrl}/videos/?${params}`);
    const data = await response.json();
    return data.hits || [];
  } catch (error) {
    console.error('Pixabay video search error:', error);
    return [];
  }
}

// ============ IPASIS (Fraud Prevention) ============
export const IPASIS_CONFIG = {
  apiKey: process.env.IPASIS_API_KEY || ''
};

export interface IPReputationResult {
  ip: string;
  score: number; // 0-100 (higher = more suspicious)
  isVPN: boolean;
  isProxy: boolean;
  isBot: boolean;
  isTor: boolean;
  country: string;
  city: string;
  isp: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export async function checkIPReputation(ip: string): Promise<IPReputationResult | null> {
  try {
    const response = await fetch(`https://api.ipasis.com/v1/check?ip=${ip}`, {
      headers: {
        'Authorization': `Bearer ${IPASIS_CONFIG.apiKey}`
      }
    });
    
    const data = await response.json();
    
    // Map risk score to level
    const riskLevel = data.score >= 80 ? 'critical' 
      : data.score >= 60 ? 'high'
      : data.score >= 30 ? 'medium'
      : 'low';
    
    return {
      ip,
      score: data.score || 0,
      isVPN: data.vpn || false,
      isProxy: data.proxy || false,
      isBot: data.bot || false,
      isTor: data.tor || false,
      country: data.country || 'Unknown',
      city: data.city || 'Unknown',
      isp: data.isp || 'Unknown',
      riskLevel
    };
  } catch (error) {
    console.error('IPasis check error:', error);
    return null;
  }
}

// ============ CRAWLBASE (Web Scraping) ============
export const CRAWLBASE_CONFIG = {
  normalToken: process.env.CRAWLBASE_NORMAL_TOKEN || '',
  jsToken: process.env.CRAWLBASE_JAVASCRIPT_TOKEN || ''
};

export async function crawlUrl(
  url: string,
  useJavaScript: boolean = false
): Promise<{ html: string; statusCode: number } | null> {
  const token = useJavaScript 
    ? CRAWLBASE_CONFIG.jsToken 
    : CRAWLBASE_CONFIG.normalToken;
  
  try {
    const response = await fetch(
      `https://api.crawlbase.com/?token=${token}&url=${encodeURIComponent(url)}`
    );
    
    const html = await response.text();
    return {
      html,
      statusCode: response.status
    };
  } catch (error) {
    console.error('Crawlbase error:', error);
    return null;
  }
}
