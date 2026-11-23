import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { insforge } from '@/lib/insforge';
import { track } from '@/lib/analytics';
import { Tag, Search, Loader2, AlertCircle, Sparkles, Clock } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import type { AIRequest } from '@/types';

interface ClassificationResult {
  hs_code: string;
  description: string;
  confidence: number;
  notes: string;
}

type AIRequestWithResults = AIRequest & {
  ai_results?: Array<{ output_data?: Record<string, unknown> }> | null;
};

export function HSCodeClassification() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  usePageMeta('HS Code Classification');
  const [productDesc, setProductDesc] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AIRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!profile) {
      setLoadingHistory(false);
      return;
    }
    try {
      setLoadingHistory(true);
      // Embed the related ai_results so the HS code can be shown in history;
      // fall back to a plain select if relation embedding isn't available.
      const embedded = await insforge.database
        .from('ai_requests')
        .select('*, ai_results(*)')
        .eq('user_id', profile.id)
        .eq('request_type', 'hs_classification')
        .order('created_at', { ascending: false })
        .limit(10);

      let data = embedded.data as AIRequest[] | null;
      let fetchError = embedded.error;

      if (fetchError) {
        const plain = await insforge.database
          .from('ai_requests')
          .select('*')
          .eq('user_id', profile.id)
          .eq('request_type', 'hs_classification')
          .order('created_at', { ascending: false })
          .limit(10);
        data = plain.data as AIRequest[] | null;
        fetchError = plain.error;
      }

      if (fetchError) throw fetchError;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching HS classification history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleClassify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productDesc.trim()) return;

    setClassifying(true);
    setError(null);
    setResult(null);

    let requestId: string | null = null;

    try {
      const systemPrompt = `You are a trade classification expert for Sri Lankan exports. Given a product description, determine the most appropriate HS (Harmoned System) code.
Output STRICTLY in this JSON format:
{"hs_code": "XXXX.XX", "description": "The official HS description", "confidence": 0.0-1.0, "notes": "Brief explanation of why this code applies"}`;

      const userPrompt = `Product description: ${productDesc}

Classify this product and respond with ONLY the JSON object, no other text.`;

      // Save the request to ai_requests first
      const { data: requestRecord, error: insertError } = await insforge.database
        .from('ai_requests')
        .insert([{
          user_id: profile?.id || null,
          request_type: 'hs_classification',
          input_data: { product_description: productDesc },
          status: 'processing',
          created_by: profile?.id || null,
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      requestId = requestRecord?.id ?? null;

      // Call AI via InsForge gateway
      const response = await insforge.ai.chat.completions.create({
        model: import.meta.env.VITE_GOOGLE_AI_MODEL || 'gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const text = response.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(t('The AI model returned an empty response. Check that the InsForge AI gateway is configured for this model.'));
      }

      // Parse JSON from response
      let parsed: ClassificationResult;
      try {
        // Try to extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch {
        // If JSON parsing fails, create a structured result from raw text
        parsed = {
          hs_code: '—',
          description: text.trim(),
          confidence: 0,
          notes: t('Raw AI response — could not parse structured data.'),
        };
      }

      setResult(parsed);

      // Analytics
      track('hs_classified', {
        product: productDesc,
        hs_code: parsed.hs_code,
        confidence: parsed.confidence,
      });

      // Persist the result
      if (requestId) {
        const modelUsed = import.meta.env.VITE_GOOGLE_AI_MODEL || 'gemma-4-31b-it';
        await insforge.database
          .from('ai_requests')
          .update({ status: 'completed', model_used: modelUsed })
          .eq('id', requestId);

        await insforge.database
          .from('ai_results')
          .insert([{
            ai_request_id: requestId,
            output_data: parsed,
            confidence_score: parsed.confidence,
            created_by: profile?.id || null,
          }]);
      }

      // Refresh history
      fetchHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(err instanceof Error ? err.message : t('Failed to classify product. Please try again.'));
      // Mark the persisted request as failed so it doesn't stay "processing"
      if (requestId) {
        try {
          await insforge.database
            .from('ai_requests')
            .update({
              status: 'failed',
              error_message: message,
            })
            .eq('id', requestId);
          fetchHistory();
        } catch {
          /* best-effort: don't mask the original error */
        }
      }
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('hs_classification')}</h1>
        <p className="text-text-secondary mt-1">
          {t('Classify your products using AI-powered HS code identification.')}
        </p>
      </div>

      {/* Classification Form */}
      <div className="card p-6 md:p-8">
        <form onSubmit={handleClassify} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              {t('Product Description')}
            </label>
            <textarea
              rows={4}
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
              className="input resize-none py-3"
              placeholder={t('Describe your product in detail — materials, composition, intended use, processing method...')}
              required
            />
            <p className="text-xs text-text-tertiary">
              {t('Example: "Organic virgin coconut oil, cold-pressed, unfiltered, packaged in 750ml glass bottles for retail export"')}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-sm text-danger-500">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={classifying || !productDesc.trim()}
              className="btn btn-primary"
            >
              {classifying ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {t('Classify Product')}
            </button>
          </div>
        </form>
      </div>

      {/* Result */}
      {result && (
        <div className="card p-6 md:p-8 border border-primary-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">{t('Classification Result')}</h3>
              <p className="text-xs text-text-tertiary">
                {t('Confidence:')} {result.confidence > 0 ? `${(result.confidence * 100).toFixed(0)}%` : t('N/A')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {t('HS Code')}
              </label>
              <p className="text-lg font-bold text-primary-500">{result.hs_code}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {t('Description')}
              </label>
              <p className="text-sm text-text-primary">{result.description}</p>
            </div>
            {result.notes && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  {t('Notes')}
                </label>
                <p className="text-sm text-text-secondary">{result.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-text-tertiary" />
          <h3 className="font-semibold text-text-primary">{t('Recent Classifications')}</h3>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-50" />
            <p className="text-sm text-text-secondary">{t('No classifications yet.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-text-tertiary font-medium">{t('Date')}</th>
                  <th className="text-left py-3 px-2 text-text-tertiary font-medium">{t('Product')}</th>
                  <th className="text-left py-3 px-2 text-text-tertiary font-medium">{t('HS Code')}</th>
                  <th className="text-left py-3 px-2 text-text-tertiary font-medium">{t('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const aiResults = (item as AIRequestWithResults).ai_results ?? undefined;
                  const hsCode = aiResults?.[0]?.output_data?.hs_code as string | undefined;
                  return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-bg-tertiary/50">
                    <td className="py-3 px-2 text-text-secondary whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 text-text-primary truncate max-w-xs">
                      {(item.input_data as Record<string, string>)?.product_description || '—'}
                    </td>
                    <td className="py-3 px-2 font-mono text-text-primary">
                      {hsCode || '—'}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`badge text-xs ${
                        item.status === 'completed' ? 'badge-success' :
                        item.status === 'failed' ? 'badge-danger' :
                        'badge-primary'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
