import 'dotenv/config';
import { Hono } from 'hono';
import { z } from 'zod';
import { validator } from 'hono/validator';
import { serve } from '@hono/node-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';

const app = new Hono();

// --- Middleware ---

app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors());

// --- Types & Interfaces ---

interface Suggestion {
    type: 'security' | 'performance' | 'style' | 'architecture';
    message: string;
    description: string;
    fixedCode?: string;
}

interface IReviewResult {
    status: string;
    message: string;
    suggestions: Suggestion[];
    security_warnings?: Suggestion[];
}

interface IReviewEngine {
    review(code: string, language: string): Promise<IReviewResult>;
}

// --- Implementations ---

class GeminiReviewEngine implements IReviewEngine {
    private genAI: GoogleGenerativeAI;
    private model: any;

    private readonly SECURITY_AUDIT_PROMPT = `
Sen "DRONA" isimli, dünyanın en katı ve titiz Senior Security Auditor ve Yazılım Mimarı'sın. 
Görevlerin:
1. Sana gönderilen kodu en ince ayrıntısına kadar incelemek, güvenlik açıklarını (SQL Injection, XSS, RCE vb.) bulmak.
2. Temiz Kod (Clean Code) standartlarını (SRP, DRY, KISS) denetlemek.
3. BULDUĞUN HER HATA İÇİN MUTLAKA "fixedCode" alanına düzelten, güvenli ve optimize edilmiş kod bloğunu ekle.

ÇIKTI KURALLARI:
1. Yanıtını HER ZAMAN geçerli bir JSON formatında ver.
2. Eğer kod mükemmelse (ki bu imkansızdır), iyileştirme için marjinal öneriler sun.
3. Sadece hataları söyleme, "reçete" yaz (fixedCode).

JSON ŞEMASI:
{
  "status": "Drona Analysis Complete",
  "message": "Kodun genel özeti",
  "suggestions": [
    {
      "type": "performance",
      "message": "Hata başlığı",
      "description": "Detaylı açıklama",
      "fixedCode": "// Düzeltilmiş kod buraya"
    }
  ],
  "security_warnings": []
}
`;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Default model, we'll handle fallback in the review method if needed
        this.model = this.genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });
    }

    private async getActiveModel(modelName: string) {
        return this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });
    }

    private staticAudit(code: string) {
        const security_warnings: Suggestion[] = [];
        const suggestions: Suggestion[] = [];

        // 1. Regex Hardened eval() Detection
        if (/\beval\s*\(/g.test(code)) {
            security_warnings.push({
                type: 'security',
                message: 'Kritik RCE Riski: eval() Kullanımı',
                description: 'eval() fonksiyonu, dışarıdan gelen verileri kod olarak çalıştırabilir ve sisteme tam erişim sağlayabilir.',
                fixedCode: '// Güvenli alternatif:\nJSON.parse(input);'
            });
        }

        // 2. SQL Injection Detection (SELECT ... FROM)
        if (/\bSELECT\b.*\bFROM\b/gi.test(code)) {
            security_warnings.push({
                type: 'security',
                message: 'SQL Injection Riski: Ham Sorgu',
                description: 'SQL sorgularına doğrudan kullanıcı girdisi eklemek veritabanı saldırılarına yol açar.',
                fixedCode: "// Parametreli sorgu örneği:\ndb.query('SELECT * FROM users WHERE id = ?', [id]);"
            });
        }

        // 3. Deep Nesting Detection (Roughly 3 levels)
        if (/if\s*\(.*\)\s*\{[^{}]*if\s*\(.*\)\s*\{[^{}]*if\s*\(.*\)\s*\{/s.test(code)) {
            suggestions.push({
                type: 'architecture',
                message: 'Zayıf Okunabilirlik: Derin İç İçe Bloklar',
                description: 'Çok fazla iç içe if bloğu kodun bakımını zorlaştırır. Erken dönüş (Early Return) kullanın.',
                fixedCode: '// Erken dönüş örneği:\nif (!condition) return;\n// İşlemlere devam et...'
            });
        }

        return { security_warnings, suggestions };
    }

    async review(code: string, language: string) {
        console.log(`[Drona] Gemini Reviewing ${language} code block...`);
        console.log("[Drona] API Key Check:", process.env.GEMINI_API_KEY ? "EXISTS (Length: " + process.env.GEMINI_API_KEY.length + ")" : "MISSING");
        
        try {
            const prompt = `${this.SECURITY_AUDIT_PROMPT}\n\nDil: ${language}\nKod:\n${code}`;
            
            let result;
            try {
                result = await this.model.generateContent(prompt);
            } catch (e: any) {
                if (e.message.includes('404') || e.message.includes('not found')) {
                    console.warn('[Drona] gemini-1.5-flash not found, trying fallback to gemini-2.0-flash-001...');
                    const fallbackModel = await this.getActiveModel("gemini-2.0-flash-001");
                    result = await fallbackModel.generateContent(prompt);
                } else {
                    throw e;
                }
            }

            const response = await result.response;
            const text = response.text();
            
            console.log('[Drona] Raw AI Response:', text);
            
            const aiResult = JSON.parse(text);

            return {
                status: aiResult.status || "Drona is watching",
                message: aiResult.message || "Kod incelendi.",
                suggestions: aiResult.suggestions || [],
                security_warnings: aiResult.security_warnings || []
            };
        } catch (error: any) {
            console.error('[Gemini Error]', error);

            // Sevk: Eğer hata 429 (Kota) ise Offline Modu çalıştır
            if (error.message.includes('429') || error.message.includes('quota')) {
                const offlineResult = this.staticAudit(code);
                
                // Eğer hiçbir bulgu yoksa "All checks passed" de
                if (offlineResult.security_warnings.length === 0 && offlineResult.suggestions.length === 0) {
                    return {
                        status: "Offline Analysis Complete",
                        message: "Gemini kotası doldu, statik tarama yapıldı. Kod temiz görünüyor.",
                        suggestions: [],
                        security_warnings: []
                    };
                }

                return {
                    status: "[Offline Scan] Quota Mode",
                    message: "Gemini kotası doldu. Drona yerel kurallarla (Static Scan) sınırlı analiz yapıyor.",
                    suggestions: offlineResult.suggestions,
                    security_warnings: offlineResult.security_warnings
                };
            }

            return {
                status: "Drona Error",
                message: `AI motoru yanıt vermedi: ${error.message || 'Bilinmeyen Hata'}`,
                suggestions: [],
                security_warnings: []
            };
        }
    }
}

// Engine Initialization
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ [Drona] GEMINI_API_KEY bulunamadı! Lütfen .env dosyasını kontrol edin.');
}

const reviewEngine = new GeminiReviewEngine(apiKey || 'missing-key');

if (apiKey) {
    console.log('🚀 [Drona] GeminiReviewEngine başarıyla başlatıldı.');
}

// --- Validation Schemas ---

const MAX_CODE_SIZE = 50 * 1024; // 50KB limit

const reviewRequestSchema = z.object({
    code: z.string().min(1).max(MAX_CODE_SIZE, "Kod bloğu 50KB'tan büyük olamaz."),
    language: z.string().min(1)
});

// --- Routes ---

app.post('/api/review', validator('json', (value, c) => {
    const parsed = reviewRequestSchema.safeParse(value);
    if (!parsed.success) {
        return c.json({
            error: "Validation Failed",
            details: parsed.error.flatten().fieldErrors
        }, 400);
    }
    return parsed.data;
}), async (c) => {
    const { code, language } = c.req.valid('json');
    
    try {
        const result = await reviewEngine.review(code, language);
        return c.json(result);
    } catch (error) {
        console.error('[Drona Error]', error);
        return c.json({ error: "Internal Server Error", message: "İnceleme sırasında bir hata oluştu." }, 500);
    }
});

// Root endpoint
app.get('/', (c) => c.text('Drona AI Code Review Agent is running.'));

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});

export default app;
