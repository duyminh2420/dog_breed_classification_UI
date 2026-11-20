import { useState } from 'react';
import {
  NOTEBOOK_MODELS,
  SWIN_T_EPOCHS,
} from '../data/dognetBenchmarks.ts';
import type { NotebookModelSpec } from '../types/dognet.ts';

type ChartMetricMode = 'accuracy' | 'loss';

export function BenchmarksSection() {
  const [selectedModelId, setSelectedModelId] =
    useState<NotebookModelSpec['id']>('swin_t');
  const [chartMode, setChartMode] = useState<ChartMetricMode>('accuracy');
  const [hoveredEpoch, setHoveredEpoch] = useState<number | null>(4);

  const selectedModel =
    NOTEBOOK_MODELS.find((m) => m.id === selectedModelId) ?? NOTEBOOK_MODELS[0];

  // SVG chart coordinate system
  const svgW = 680;
  const svgH = 270;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 38;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  const yMin = chartMode === 'accuracy' ? 0.5 : 0;
  const yMax = chartMode === 'accuracy' ? 1.0 : 3.0;

  const xForEpoch = (epoch: number) => padLeft + (epoch / 9) * plotW;
  const yForValue = (val: number) =>
    padTop + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

  const trainPath = SWIN_T_EPOCHS.map((d, idx) => {
    const val = chartMode === 'accuracy' ? d.trainAcc : d.trainLoss;
    return `${idx === 0 ? 'M' : 'L'} ${xForEpoch(d.epoch).toFixed(1)} ${yForValue(val).toFixed(1)}`;
  }).join(' ');

  const testPath = SWIN_T_EPOCHS.map((d, idx) => {
    const val = chartMode === 'accuracy' ? d.testAcc : d.testLoss;
    return `${idx === 0 ? 'M' : 'L'} ${xForEpoch(d.epoch).toFixed(1)} ${yForValue(val).toFixed(1)}`;
  }).join(' ');

  const yTicks =
    chartMode === 'accuracy'
      ? [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
      : [0.0, 0.75, 1.5, 2.25, 3.0];

  const activeEpochData =
    SWIN_T_EPOCHS.find((e) => e.epoch === hoveredEpoch) ?? SWIN_T_EPOCHS[4];

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          DogNet Model Accuracy &amp; Training Benchmarks
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Empirical training and validation metrics extracted directly from{' '}
          <span className="font-mono text-xs text-slate-800">
            final_DogNet__1__3ebfd580.ipynb
          </span>
          .
        </p>
      </div>

      {/* Top KPI Grid */}
      <div className="grid grid-cols-2 border border-slate-200 bg-white lg:grid-cols-4">
        <div className="border-b border-r border-slate-200 p-4 lg:border-b-0">
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Swin-T Peak Val Accuracy
          </div>
          <div className="mt-1.5 font-mono text-3xl font-bold text-blue-600 tabular-nums">
            96.43%
          </div>
          <div className="mt-1 font-mono text-xs text-emerald-700 tabular-nums">
            Epoch 4 · 0.964286
          </div>
        </div>

        <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Final Test Accuracy
          </div>
          <div className="mt-1.5 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            96.14%
          </div>
          <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            Epoch 9 · Test Loss 0.1591
          </div>
        </div>

        <div className="border-r border-slate-200 p-4">
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Target Breed Classes
          </div>
          <div className="mt-1.5 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            71
          </div>
          <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            Batch Size 16 · 10 Epochs
          </div>
        </div>

        <div className="p-4">
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Swin-T Training Elapsed
          </div>
          <div className="mt-1.5 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            12m 36s
          </div>
          <div className="mt-1 font-mono text-xs text-slate-500">
            SGD lr=0.001 · StepLR(7, 0.1)
          </div>
        </div>
      </div>

      {/* Notebook Model Selector + Specs */}
      <div className="border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-700">
            Evaluated Architectures in Notebook
          </span>
          <div className="flex flex-wrap border border-slate-300 bg-white">
            {NOTEBOOK_MODELS.map((model, idx) => (
              <button
                key={model.id}
                type="button"
                onClick={() => setSelectedModelId(model.id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  idx > 0 ? 'border-l border-slate-300' : ''
                } ${
                  selectedModelId === model.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {model.id === 'swin_t'
                  ? 'Swin-T'
                  : model.id === 'resnet18'
                    ? 'ResNet-18'
                    : 'AlexNet'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            <h2 className="text-lg font-bold text-slate-900">{selectedModel.name}</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              {selectedModel.summary}
            </p>
            <div className="border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700">
              Status: {selectedModel.notebookStatus}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 text-xs sm:grid-cols-2 lg:col-span-7 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Pretrained Backbone
              </div>
              <div className="mt-1 font-mono font-medium text-slate-900">
                {selectedModel.torchvisionWeights}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Fine-Tuning Scope
              </div>
              <div className="mt-1 font-medium text-slate-900">
                {selectedModel.trainingScope}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Classifier Head
              </div>
              <div className="mt-1 font-mono text-slate-900">
                {selectedModel.headArchitecture}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Optimizer
              </div>
              <div className="mt-1 font-mono text-slate-900">
                {selectedModel.optimizer}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                LR Scheduler
              </div>
              <div className="mt-1 font-mono text-slate-900">
                {selectedModel.scheduler}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Swin-T Dual-Curve Chart & Epoch Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="border border-slate-200 bg-white lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-700">
              Swin-T Convergence Curves (Epochs 0–9)
            </span>
            <div className="flex items-center border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => setChartMode('accuracy')}
                className={`px-3 py-1 font-mono text-[11px] font-medium ${
                  chartMode === 'accuracy'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Accuracy
              </button>
              <button
                type="button"
                onClick={() => setChartMode('loss')}
                className={`border-l border-slate-300 px-3 py-1 font-mono text-[11px] font-medium ${
                  chartMode === 'loss'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Loss
              </button>
            </div>
          </div>

          <div className="p-4">
            {/* Crosshair HUD Readout */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs tabular-nums">
              <span className="font-semibold text-slate-900">
                Epoch {activeEpochData.epoch}/9
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-blue-600">
                  ● Test {chartMode === 'accuracy' ? 'Acc' : 'Loss'}:{' '}
                  <strong>
                    {chartMode === 'accuracy'
                      ? `${(activeEpochData.testAcc * 100).toFixed(2)}%`
                      : activeEpochData.testLoss.toFixed(4)}
                  </strong>
                </span>
                <span className="text-slate-600">
                  ○ Train {chartMode === 'accuracy' ? 'Acc' : 'Loss'}:{' '}
                  <strong>
                    {chartMode === 'accuracy'
                      ? `${(activeEpochData.trainAcc * 100).toFixed(2)}%`
                      : activeEpochData.trainLoss.toFixed(4)}
                  </strong>
                </span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full overflow-visible"
              role="img"
              aria-label={`Swin-T ${chartMode} across epochs 0 to 9`}
            >
              {/* Horizontal Grid Lines */}
              {yTicks.map((tick) => {
                const y = yForValue(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgW - padRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 font-mono text-[10px]"
                    >
                      {chartMode === 'accuracy'
                        ? `${Math.round(tick * 100)}%`
                        : tick.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Epoch Guide */}
              {SWIN_T_EPOCHS.map((d) => {
                const x = xForEpoch(d.epoch);
                const isSelected = activeEpochData.epoch === d.epoch;
                return (
                  <g key={d.epoch}>
                    {isSelected && (
                      <line
                        x1={x}
                        y1={padTop}
                        x2={x}
                        y2={padTop + plotH}
                        stroke="#94a3b8"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    )}
                    <text
                      x={x}
                      y={svgH - 12}
                      textAnchor="middle"
                      className={`font-mono text-[10px] ${
                        isSelected ? 'fill-slate-900 font-bold' : 'fill-slate-500'
                      }`}
                    >
                      E{d.epoch}
                    </text>
                  </g>
                );
              })}

              {/* Train Curve (Dashed) */}
              <path
                d={trainPath}
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="5 4"
              />

              {/* Test Curve (Solid Cobalt) */}
              <path
                d={testPath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
              />

              {/* Interactive Data Points */}
              {SWIN_T_EPOCHS.map((d) => {
                const x = xForEpoch(d.epoch);
                const yTest = yForValue(
                  chartMode === 'accuracy' ? d.testAcc : d.testLoss
                );
                const yTrain = yForValue(
                  chartMode === 'accuracy' ? d.trainAcc : d.trainLoss
                );
                const isSelected = activeEpochData.epoch === d.epoch;

                return (
                  <g
                    key={`pt-${d.epoch}`}
                    onMouseEnter={() => setHoveredEpoch(d.epoch)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x - plotW / 20}
                      y={padTop}
                      width={plotW / 10}
                      height={plotH}
                      fill="transparent"
                    />
                    <circle
                      cx={x}
                      cy={yTrain}
                      r={isSelected ? 4.5 : 3}
                      fill="#ffffff"
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    <circle
                      cx={x}
                      cy={yTest}
                      r={isSelected ? 5.5 : 3.5}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}
            </svg>

            <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-500">
              <span>Solid Blue: Validation (Test) · Dashed Slate: Training</span>
              <span>Hover data columns to inspect exact epoch values</span>
            </div>
          </div>
        </div>

        {/* Exact Epoch Table */}
        <div className="border border-slate-200 bg-white lg:col-span-5">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-700">
              Epoch-by-Epoch Telemetry
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] uppercase text-slate-500">
                  <th className="px-3 py-2.5">Epoch</th>
                  <th className="px-3 py-2.5 text-right">Train Loss</th>
                  <th className="px-3 py-2.5 text-right">Train Acc</th>
                  <th className="px-3 py-2.5 text-right">Test Loss</th>
                  <th className="px-3 py-2.5 text-right">Test Acc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {SWIN_T_EPOCHS.map((row) => {
                  const isBest = row.epoch === 4;
                  const isHovered = activeEpochData.epoch === row.epoch;
                  return (
                    <tr
                      key={row.epoch}
                      onMouseEnter={() => setHoveredEpoch(row.epoch)}
                      className={`cursor-pointer transition-colors ${
                        isHovered ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {row.epoch}
                        {isBest ? ' ★' : ''}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {row.trainLoss.toFixed(4)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {(row.trainAcc * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {row.testLoss.toFixed(4)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          isBest ? 'text-blue-600' : 'text-slate-900'
                        }`}
                      >
                        {(row.testAcc * 100).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
