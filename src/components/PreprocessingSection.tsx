import { PREPROCESSING_SPEC } from '../data/dognetBenchmarks.ts';
import type { PreprocessedImageBundle } from '../utils/imagePreprocessing.ts';

interface PreprocessingSectionProps {
  currentBundle: PreprocessedImageBundle | null;
}

export function PreprocessingSection({ currentBundle }: PreprocessingSectionProps) {
  return (
    <section className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Tensor &amp; Image Preprocessing Pipeline
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Browser canvas preprocessing aligned with Cell 2 of{' '}
          <span className="font-mono text-xs text-slate-800">
            final_DogNet__1__3ebfd580.ipynb
          </span>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="border border-slate-200 bg-white lg:col-span-7">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-700">
              Torchvision Data Transforms Specification
            </span>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-5">
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500">
                Training Transform (&apos;train&apos;)
              </div>
              <ol className="mt-3 space-y-2 font-mono text-xs text-slate-800">
                {PREPROCESSING_SPEC.trainTransforms.map((step, idx) => (
                  <li key={step} className="flex gap-2">
                    <span className="text-slate-400">0{idx + 1}</span>
                    <span className="break-all">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="p-5">
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-600">
                Inference / Eval Transform (&apos;test&apos;)
              </div>
              <ol className="mt-3 space-y-2 font-mono text-xs text-slate-800">
                {PREPROCESSING_SPEC.testTransforms.map((step, idx) => (
                  <li key={step} className="flex gap-2">
                    <span className="text-slate-400">0{idx + 1}</span>
                    <span className="break-all">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-5">
            <div className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-600">
              ImageNet Channel Normalization Constants
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 font-mono text-xs tabular-nums">
              <div className="border border-slate-200 bg-white p-3">
                <div className="text-slate-400">Red Channel</div>
                <div className="mt-1 font-semibold text-slate-900">
                  μ = {PREPROCESSING_SPEC.normalizationMean[0]}
                </div>
                <div className="text-slate-600">
                  σ = {PREPROCESSING_SPEC.normalizationStd[0]}
                </div>
              </div>
              <div className="border border-slate-200 bg-white p-3">
                <div className="text-slate-400">Green Channel</div>
                <div className="mt-1 font-semibold text-slate-900">
                  μ = {PREPROCESSING_SPEC.normalizationMean[1]}
                </div>
                <div className="text-slate-600">
                  σ = {PREPROCESSING_SPEC.normalizationStd[1]}
                </div>
              </div>
              <div className="border border-slate-200 bg-white p-3">
                <div className="text-slate-400">Blue Channel</div>
                <div className="mt-1 font-semibold text-slate-900">
                  μ = {PREPROCESSING_SPEC.normalizationMean[2]}
                </div>
                <div className="text-slate-600">
                  σ = {PREPROCESSING_SPEC.normalizationStd[2]}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live 224x224 Tensor Inspector */}
        <div className="border border-slate-200 bg-white lg:col-span-5">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-700">
              Active 224×224 Center-Crop Inspector
            </span>
          </div>
          <div className="p-5">
            {currentBundle ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center border border-slate-200 bg-slate-950 p-4">
                  <img
                    src={currentBundle.centerCropDataUrl}
                    alt="224x224 center-cropped dog tensor"
                    className="h-56 w-56 border border-cyan-400 object-cover"
                  />
                </div>
                <div className="space-y-2 border-t border-slate-200 pt-3 font-mono text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Source Dimensions</span>
                    <span className="font-semibold text-slate-900">
                      {currentBundle.originalWidth} × {currentBundle.originalHeight} px
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cropped Tensor Shape</span>
                    <span className="font-semibold text-slate-900">3 × 224 × 224</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Measured Crop Mean (RGB)</span>
                    <span className="font-semibold text-blue-600">
                      [{currentBundle.channelStats.meanR.toFixed(3)},{' '}
                      {currentBundle.channelStats.meanG.toFixed(3)},{' '}
                      {currentBundle.channelStats.meanB.toFixed(3)}]
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Measured Crop Std (RGB)</span>
                    <span className="font-semibold text-slate-900">
                      [{currentBundle.channelStats.stdR.toFixed(3)},{' '}
                      {currentBundle.channelStats.stdG.toFixed(3)},{' '}
                      {currentBundle.channelStats.stdB.toFixed(3)}]
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No active image loaded yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Upload or capture a photo in the Classifier tab to inspect its live 224×224 center crop and measured RGB statistics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
