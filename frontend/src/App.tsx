import { useState } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Code2, 
  Terminal, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Loader2,
  ScanSearch
} from 'lucide-react';

interface Suggestion {
  type: 'security' | 'performance' | 'style' | 'architecture';
  message: string;
  description: string;
  fixedCode?: string;
}

interface ReviewResult {
  status: string;
  message: string;
  suggestions: Suggestion[];
  security_warnings?: Suggestion[];
}

const SuggestionCard = ({ suggestion, isCritical = false }: { suggestion: Suggestion, isCritical?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIcon = () => {
    if (isCritical) return <ShieldAlert className="w-6 h-6 text-orange-500" />;
    switch (suggestion.type) {
      case 'security': return <ShieldAlert className="w-4 h-4 text-red-400" />;
      case 'performance': return <Loader2 className="w-4 h-4 text-blue-400" />;
      case 'style': return <Code2 className="w-4 h-4 text-green-400" />;
      case 'architecture': return <Terminal className="w-4 h-4 text-purple-400" />;
      default: return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className={`p-5 rounded-xl border transition-all ${
      isCritical 
        ? 'bg-orange-500/10 border-orange-500 shadow-xl shadow-orange-950/20' 
        : 'bg-slate-800/30 border-slate-800'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-1">{getIcon()}</div>
        <div>
          <h3 className={`text-sm font-black uppercase tracking-tight ${isCritical ? 'text-orange-400' : 'text-slate-200'}`}>
            {suggestion.message || 'Öneri'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {suggestion.description || 'Açıklama bulunmuyor.'}
          </p>
        </div>
      </div>

      {suggestion.fixedCode && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Suggested Fix</span>
            <button 
              onClick={() => copyToClipboard(suggestion.fixedCode || '')}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition-colors border border-slate-700"
            >
              {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Code2 className="w-3 h-3" />}
              {copied ? 'COPIED!' : 'COPY'}
            </button>
          </div>
          <div className="relative group">
            <pre className="bg-black/40 p-4 rounded-lg font-mono text-[11px] text-slate-300 border border-slate-800/50 overflow-x-auto whitespace-pre-wrap">
              {suggestion.fixedCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [code, setCode] = useState<string>('// Paste your code here for Drona to analyze...\n\nfunction example() {\n  eval("console.log(1)");\n}');
  const [results, setResults] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://localhost:3000/api/review', {
        code,
        language: 'javascript'
      });
      setResults(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Bağlantı Hatası: Backend sunucusuna ulaşılamıyor.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0F172A] text-slate-200 font-fira-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg">
            <ScanSearch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-fira-code tracking-tight">DRONA <span className="text-primary">AI</span></h1>
            <p className="text-xs text-slate-400">Advanced Code Security & Audit</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-medium">Engine Active</span>
          </div>
          <button 
            onClick={analyzeCode}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-blue-600 disabled:bg-slate-700 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {loading ? 'ANALYZING...' : 'RUN SECURITY SCAN'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Editor */}
        <div className="flex-1 h-full flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-800 text-xs font-medium text-slate-400">
            <Code2 className="w-3.5 h-3.5" />
            <span>EDITOR (Javascript)</span>
          </div>
          <div className="flex-1 w-full overflow-hidden border-r border-slate-800">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                fontSize: 14,
                fontFamily: 'Fira Code',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
                padding: { top: 20 },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on'
              }}
            />
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="w-[450px] h-full overflow-y-auto glass-panel bg-slate-900/30 flex flex-col border-l border-slate-800">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800 sticky top-0 bg-[#0F172A]/90 backdrop-blur-md z-10">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold tracking-widest uppercase">Analysis Report</span>
          </div>

          <div className="p-6 space-y-6">
            {!results && !error && !loading && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 text-slate-500">
                <ScanSearch className="w-16 h-16 opacity-20" />
                <div className="space-y-1">
                  <p className="font-bold text-sm">Ready for Scan</p>
                  <p className="text-[11px] max-w-[200px]">Paste your code in the editor and click the scan button to start the audit.</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-slate-800/20 animate-pulse rounded-lg border border-slate-800/50"></div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-red-400">{error.includes('50KB') ? 'Dosya Çok Büyük' : 'Connection Error'}</h3>
                  <p className="text-xs text-red-400/80 mt-1">{error}</p>
                </div>
              </div>
            )}

            {results && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Security Warnings Section */}
                {results.security_warnings && results.security_warnings.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <ShieldAlert className="w-4 h-4 text-orange-500" />
                       <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500/80">Critical Threats</h3>
                    </div>
                    {results.security_warnings.map((sw, idx) => (
                      <SuggestionCard key={idx} suggestion={sw} isCritical={true} />
                    ))}
                  </div>
                )}

                {/* Review Summary */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Review Summary</h3>
                  </div>
                  
                  <div className="p-5 bg-slate-800/30 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-800/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary">
                        <Info className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold italic">{results.status}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">
                      {results.message}
                    </p>
                  </div>
                </div>

                {/* Suggestions Section */}
                {results.suggestions && results.suggestions.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">General Improvements</h3>
                    </div>
                    {results.suggestions.map((s, idx) => (
                      <SuggestionCard key={idx} suggestion={s} />
                    ))}
                  </div>
                )}

                {/* Integration Status */}
                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Backend Protocol</span>
                  <span className="text-[10px] text-blue-400 font-mono">v1.2.0-STABLE</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-2 border-t border-slate-800 bg-[#0F172A]/80 backdrop-blur-md text-[10px] text-slate-500 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span>&copy; 2026 DRONA CLOUD UNIT</span>
          <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
          <span>LATENCY: 12ms</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">NODE ES2026</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
