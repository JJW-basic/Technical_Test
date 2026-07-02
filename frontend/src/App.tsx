import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Globe, Key, FileText, AlertCircle, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ScrapingResponse {
  status: 'success' | 'policy_denied' | 'path_denied';
  domain: string;
  markdown_file?: string;
  markdown_content?: string;
  keyword_counts?: Record<string, number>;
  message: string;
}

type AppState = 'idle' | 'loading' | 'success' | 'error';

const LOADING_STEPS = [
  '정책 파일 확인 중...',
  '페이지 스크래핑 중...',
  '키워드 분석 중...',
];

// ---------------------------------------------------------------------------
// Utility: 마크다운 콘텐츠에서 키워드 강조
// ---------------------------------------------------------------------------
function highlightKeywords(text: string, keywords: string[]): React.ReactNode[] {
  if (!keywords.length || !text) return [text];

  // 모든 키워드를 하나의 정규식으로 결합 (case-insensitive)
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const isKeyword = keywords.some(k => k.toLowerCase() === part.toLowerCase());
    if (isKeyword) {
      return (
        <mark
          key={i}
          className="bg-yellow-400/30 text-yellow-200 font-bold text-[1.05em] rounded px-0.5 border-b border-yellow-400/60"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** 단계별 로딩 인디케이터 */
function LoadingIndicator({ step }: { step: number }) {
  return (
    <section
      id="loading-indicator"
      className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-md flex flex-col items-center gap-6"
    >
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" style={{ animationDirection: 'reverse' }} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-slate-200 font-semibold text-lg">{LOADING_STEPS[step]}</p>
        <p className="text-slate-500 text-sm">잠시 기다려 주세요...</p>
      </div>

      {/* 단계 표시 */}
      <div className="flex items-center gap-3">
        {LOADING_STEPS.map((label, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                idx < step
                  ? 'bg-emerald-400'
                  : idx === step
                  ? 'bg-blue-400 animate-pulse scale-125'
                  : 'bg-slate-700'
              }`}
            />
            {idx < LOADING_STEPS.length - 1 && (
              <div className={`w-8 h-px transition-all duration-500 ${idx < step ? 'bg-emerald-400/50' : 'bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600">
        단계 {step + 1} / {LOADING_STEPS.length}
      </p>
    </section>
  );
}

/** 분석 결과 리포트 */
function AnalysisReport({
  data,
  keywords,
}: {
  data: ScrapingResponse;
  keywords: string[];
}) {
  const totalFound = Object.values(data.keyword_counts || {}).reduce((a, b) => a + b, 0);
  const hasKeywords = totalFound > 0;

  return (
    <section id="analysis-report" className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-400 px-1">
        <FileText className="w-4 h-4 text-blue-500" />
        분석 결과 리포트
      </div>

      {/* 메타 정보 카드 */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-200 text-sm">스크래핑 완료</span>
          <span className="ml-auto text-xs font-mono text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">
            {data.domain}
          </span>
        </div>

        {data.markdown_file && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText className="w-3.5 h-3.5" />
            저장 파일: <code className="text-blue-400 font-mono ml-1">{data.markdown_file}</code>
          </div>
        )}

        {/* 키워드 카운트 배지 */}
        <div className="border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-500 mb-2 font-medium">키워드 출현 횟수</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.keyword_counts || {}).map(([kw, count]) => (
              <span
                key={kw}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold border ${
                  count > 0
                    ? 'bg-yellow-400/10 text-yellow-300 border-yellow-400/20'
                    : 'bg-slate-700/40 text-slate-500 border-slate-700'
                }`}
              >
                "{kw}"
                <span className={`font-mono font-bold ${count > 0 ? 'text-yellow-200' : 'text-slate-600'}`}>
                  {count}회
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 콘텐츠 뷰어 */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-slate-950/40">
          <span className="text-xs font-semibold text-slate-400">스크래핑 콘텐츠</span>
          {!hasKeywords && (
            <span className="text-xs text-slate-500 italic">사용자가 요청한 정보가 없습니다.</span>
          )}
        </div>
        <pre
          id="scraped-content"
          className="p-5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono max-h-[480px] overflow-y-auto"
        >
          {highlightKeywords(data.markdown_content || '', keywords)}
        </pre>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App() {
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<ScrapingResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 로딩 중 단계 자동 전환 타이머
  useEffect(() => {
    if (appState === 'loading') {
      setLoadingStep(0);
      stepTimerRef.current = setInterval(() => {
        setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
      }, 4000);
    } else {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    }
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [appState]);

  const resetToIdle = () => {
    setAppState('idle');
    setResult(null);
    setErrorMsg(null);
    setLoadingStep(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- 클라이언트 측 입력 검증 ---
    if (!url.trim() || !keywords.trim()) {
      setErrorMsg('정상적인 접근이 아닙니다.');
      setAppState('error');
      setUrl('');
      setKeywords('');
      return;
    }

    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);

    setAppState('loading');
    setResult(null);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), keywords: keywordList }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `서버 요청 실패 (상태 코드: ${response.status})`);
      }

      // policy_denied / path_denied 처리
      if (data.status === 'policy_denied' || data.status === 'path_denied') {
        setUrl('');  // URL 입력 필드 클리어
        setErrorMsg(data.message);
        setAppState('error');
        return;
      }

      setResult(data);
      setAppState('success');
    } catch (err: any) {
      setErrorMsg(err.message || '요청 중 에러가 발생했습니다.');
      setAppState('error');
    }
  };

  const submittedKeywords = keywords.split(',').map(k => k.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-12 px-4 selection:bg-blue-600 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none rounded-full blur-3xl" />

      <header className="relative z-10 max-w-2xl text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-950/40 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4 backdrop-blur-sm">
          <Search className="w-3.5 h-3.5 animate-pulse" />
          WEB SCRAPER ENGINE
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-slate-100 to-blue-400">
          정보 수집 및 키워드 분석
        </h1>
        <p className="mt-3 text-slate-400 md:text-lg">
          URL 주소와 관심 키워드를 입력하시면 관련 데이터를 수집하여 정리해 드립니다.
        </p>
      </header>

      <main className="relative z-10 w-full max-w-2xl flex flex-col gap-8">

        {/* 입력 폼 — 로딩/성공 중에도 항상 표시 */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-2xl shadow-slate-950/50">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="url-input" className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                대상 웹페이지 URL
              </label>
              <input
                id="url-input"
                type="url"
                required
                placeholder="https://example.com"
                value={url}
                disabled={appState === 'loading'}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="keywords-input" className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-500" />
                관심 키워드 <span className="text-xs text-slate-500 font-normal">(콤마 ','로 구분)</span>
              </label>
              <input
                id="keywords-input"
                type="text"
                required
                placeholder="AI, 머신러닝, 딥러닝"
                value={keywords}
                disabled={appState === 'loading'}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex gap-3">
              <button
                id="submit-btn"
                type="submit"
                disabled={appState === 'loading'}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                {appState === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    분석 요청하기
                  </>
                )}
              </button>

              {/* 결과 초기화 버튼 */}
              {(appState === 'success' || appState === 'error') && (
                <button
                  id="reset-btn"
                  type="button"
                  onClick={resetToIdle}
                  className="px-4 py-3.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 flex items-center gap-2 transition-all text-sm font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  초기화
                </button>
              )}
            </div>
          </form>
        </section>

        {/* 로딩 인디케이터 */}
        {appState === 'loading' && <LoadingIndicator step={loadingStep} />}

        {/* 에러 메시지 */}
        {appState === 'error' && errorMsg && (
          <section
            id="error-section"
            className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl p-4 flex items-start gap-3"
          >
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">요청 처리 실패</h3>
              <p className="text-xs text-red-400/90 mt-1">{errorMsg}</p>
            </div>
          </section>
        )}

        {/* 분석 결과 리포트 */}
        {appState === 'success' && result && (
          <AnalysisReport data={result} keywords={submittedKeywords} />
        )}
      </main>
    </div>
  );
}

export default App;
