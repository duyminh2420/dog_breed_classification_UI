import { useState } from 'react';
import { TopBar, type ActiveTab } from './components/TopBar.tsx';
import { CaptureWorkspace } from './components/CaptureWorkspace.tsx';
import { BenchmarksSection } from './components/BenchmarksSection.tsx';
import { PreprocessingSection } from './components/PreprocessingSection.tsx';
import type { ClassificationHistoryEntry } from './types/dognet.ts';
import type { PreprocessedImageBundle } from './utils/imagePreprocessing.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('classifier');
  const [uploadTrigger, setUploadTrigger] = useState(0);
  const [currentBundle, setCurrentBundle] =
    useState<PreprocessedImageBundle | null>(null);
  const [history, setHistory] = useState<ClassificationHistoryEntry[]>([]);

  const handleQuickUpload = () => {
    setActiveTab('classifier');
    setUploadTrigger((prev) => prev + 1);
  };

  const handleAddHistory = (entry: ClassificationHistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, 12));
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onQuickUploadClick={handleQuickUpload}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'classifier' && (
          <CaptureWorkspace
            externalFileInputTrigger={uploadTrigger}
            currentBundle={currentBundle}
            onBundleChange={setCurrentBundle}
            history={history}
            onAddHistory={handleAddHistory}
            onClearHistory={() => setHistory([])}
          />
        )}
        {activeTab === 'benchmarks' && <BenchmarksSection />}
        {activeTab === 'preprocessing' && (
          <PreprocessingSection currentBundle={currentBundle} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 font-mono text-xs text-slate-500 sm:px-6 lg:px-8">
          <span>
            DogNet Vision Interface · 71-Class Breed Classification
          </span>
          <span>
            Notebook Reference: final_DogNet__1__3ebfd580.ipynb · Swin-T 96.43% Val Accuracy
          </span>
        </div>
      </footer>
    </div>
  );
}
