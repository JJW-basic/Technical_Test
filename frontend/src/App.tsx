import { useState } from 'react';
import { Search, Loader2, Globe, Key, FileText, AlertCircle } from 'lucide-react';

interface ScrapeResult {
  url: string;
  keyword: string;
  found: boolean;
  details?: string;
}

function App() {
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !keywords.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          keywords: keywordList,
        }),
      });

      if (!response.ok) {
        throw new Error(`서버 요청 실패 (상태 코드: ${response.status})`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || '요청 중 에러가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
        {/* Form Container */}
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
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
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
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  정보 분석하는 중...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  분석 요청하기
                </>
              )}
            </button>
          </form>
        </section>

        {/* Error Message */}
        {error && (
          <section className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">요청 처리 실패</h3>
              <p className="text-xs text-red-400/90 mt-1">{error}</p>
            </div>
          </section>
        )}

        {/* Results Container */}
        {results.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-400 px-1">
              <FileText className="w-4 h-4 text-blue-500" />
              분석 결과 리포트
            </div>
            
            <div className="flex flex-col gap-3">
              {results.map((res, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                    <span className="text-xs font-mono text-slate-500 truncate max-w-[280px] md:max-w-md">
                      출처: {res.url}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        res.found
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {res.found ? '키워드 확인됨' : '키워드 없음'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <div className="flex items-center gap-2 font-semibold text-slate-200 mb-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                      키워드: "{res.keyword}"
                    </div>
                    <p className="text-slate-400 text-xs md:text-sm leading-relaxed pl-3.5 border-l border-slate-800">
                      {res.found ? res.details : '사용자가 요청한 정보가 없습니다.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
