import { render } from 'preact';
import { useState } from 'preact/hooks';

import {
	createDemoRun,
	demoProviders,
	getDemoModels,
	getDemoSelection,
	type DemoProviderId,
} from '../../core/index';
import './style.css';

const initialSelection = getDemoSelection(demoProviders[0].id);
const initialModels = getDemoModels(initialSelection.provider.id);

export function App() {
	const [providerId, setProviderId] = useState<DemoProviderId>(initialSelection.provider.id);
	const providerModels = getDemoModels(providerId);
	const [modelId, setModelId] = useState(providerModels[0]?.id ?? initialModels[0].id);
	const [prompt, setPrompt] = useState('src/core から呼び出した最小ロジックの確認です。');
	const [result, setResult] = useState(() =>
		createDemoRun({
			providerId: initialSelection.provider.id,
			modelId: initialSelection.model.id,
			prompt: 'src/core から呼び出した最小ロジックの確認です。',
		}),
	);

	const selectedProvider = demoProviders.find((entry) => entry.id === providerId) ?? initialSelection.provider;
	const selectedModel =
		providerModels.find((entry) => entry.id === modelId) ?? providerModels[0] ?? initialSelection.model;

	function handleProviderChange(event: Event) {
		const nextProviderId = (event.currentTarget as HTMLSelectElement).value as DemoProviderId;
		const nextModels = getDemoModels(nextProviderId);
		const nextSelection = getDemoSelection(nextProviderId);
		const nextModelId = nextModels.find((entry) => entry.id === nextSelection.model.id)?.id ?? nextModels[0]?.id ?? '';

		setProviderId(nextProviderId);
		setModelId(nextModelId);
	}

	function handleModelChange(event: Event) {
		setModelId((event.currentTarget as HTMLSelectElement).value);
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		setResult(
			createDemoRun({
				providerId,
				modelId,
				prompt,
			}),
		);
	}

	return (
		<main class="app-shell">
			<section class="hero-card">
				<div class="hero-copy">
					<p class="eyebrow">{"src/core -> src/ui"}</p>
					<h1>最小構成の動作確認画面</h1>
					<p class="lede">
						この画面は <code>src/core</code> の純粋関数を <code>src/ui</code> から呼び出して、
						拡張機能のビルド確認に使える最小の導線を示します。
					</p>
				</div>

				<div class="status-panel">
					<div class="status-row">
						<span class={`status-badge status-${result.statusLabel}`}>{result.statusLabel}</span>
						<span class="status-note">webview / build 検証用</span>
					</div>
					<div class="status-grid">
						<div>
							<dt>Provider</dt>
							<dd>{selectedProvider.name}</dd>
						</div>
						<div>
							<dt>Model</dt>
							<dd>{selectedModel.name}</dd>
						</div>
						<div>
							<dt>Endpoint</dt>
							<dd>{selectedProvider.baseUrl}</dd>
						</div>
					</div>
				</div>
			</section>

			<section class="workspace">
				<form class="panel" onSubmit={handleSubmit}>
					<div class="panel-header">
						<h2>入力</h2>
						<p>Provider と Model を切り替えて、core の返り値の変化を確認します。</p>
					</div>

						<label class="field">
							<span>Provider</span>
							<select value={providerId} onChange={handleProviderChange}>
								{demoProviders.map((provider) => (
									<option key={provider.id} value={provider.id}>
										{provider.name}
									</option>
								))}
							</select>
						</label>

						<label class="field">
							<span>Model</span>
							<select value={modelId} onChange={handleModelChange}>
								{providerModels.map((model) => (
									<option key={model.id} value={model.id}>
										{model.name}
									</option>
								))}
							</select>
						</label>

					<label class="field">
						<span>確認メッセージ</span>
						<textarea
							rows={5}
							value={prompt}
							onInput={(event) => setPrompt((event.currentTarget as HTMLTextAreaElement).value)}
							placeholder="動作確認したい文字列を入力"
						/>
					</label>

					<button class="primary-button" type="submit">
						core を実行
					</button>
				</form>

				<aside class="panel result-panel">
					<div class="panel-header">
						<h2>結果</h2>
						<p>ビルド後にエディタへ読み込ませる際の見え方を意識したサンプル表示です。</p>
					</div>

					<div class="result-body">
						<div class="result-title-row">
							<h3>{result.title}</h3>
							<span class="result-time">{result.timestamp}</span>
						</div>

						<p class="result-copy">{result.response}</p>

						<div class="result-block">
							<span class="result-label">Prompt</span>
							<pre>{result.prompt}</pre>
						</div>

						<div class="result-block">
							<span class="result-label">Checklist</span>
							<ul class="checklist">
								{result.checklist.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
					</div>
				</aside>
			</section>
		</main>
	);
}

render(<App />, document.getElementById('app') as HTMLElement);
