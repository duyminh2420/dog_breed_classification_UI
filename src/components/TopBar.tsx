import { Upload } from 'lucide-react';

export type ActiveTab = 'classifier' | 'benchmarks' | 'preprocessing';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onQuickUploadClick: () => void;
}

export function TopBar({
  activeTab,
  onSelectTab,
  onQuickUploadClick,
}: TopBarProps) {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'classifier', label: 'Classifier' },
    { id: 'benchmarks', label: 'Model Benchmarks' },
    { id: 'preprocessing', label: 'Preprocessing' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onSelectTab('classifier')}
          className="flex shrink-0 items-center gap-2.5 text-left focus:outline-none"
        >
          <span className="flex h-8 w-8 items-center justify-center border border-slate-300 bg-slate-900 text-white">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7V4h3" />
              <path d="M17 4h3v3" />
              <path d="M20 17v3h-3" />
              <path d="M7 20H4v-3" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span className="whitespace-nowrap font-semibold tracking-tight text-slate-900">
            DogNet
          </span>
          <span className="hidden whitespace-nowrap font-mono text-xs text-slate-500 sm:inline">
            71-Class Vision Lab
          </span>
        </button>

        <nav
          aria-label="Primary Navigation"
          className="flex items-center gap-6 overflow-x-auto sm:gap-8"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative h-14 shrink-0 whitespace-nowrap text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onQuickUploadClick}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload Image</span>
          </button>
        </div>
      </div>
    </header>
  );
}
