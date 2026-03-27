import { StabilityAPI } from '../../stability_api';
import { ModelViewer } from '../../model_viewer';

export class ImageTo3DComponent {
  private container: HTMLElement;
  private fileInput!: HTMLInputElement;
  private promptInput!: HTMLInputElement;
  private generateButton!: HTMLButtonElement;
  private statusDiv!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private modelViewer: ModelViewer | null = null;
  private stabilityAPI: StabilityAPI | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.createUI();
    this.setupEventListeners();
  }

  private createUI(): void {
    this.container.innerHTML = `
      <div class="image-to-3d-container">
        <div class="viewer-section">
          <h3>3Dビューア</h3>
          <canvas id="model-canvas" width="800" height="500"></canvas>
        </div>

        <div class="controls-section">
          <h3>画像から3Dモデル生成</h3>

          <div class="api-key-section">
            <label for="api-key">Stability AI API Key:</label>
            <input type="password" id="api-key" placeholder="APIキーを入力してください">
          </div>

          <div class="upload-section">
            <label for="image-upload">画像を選択:</label>
            <input type="file" id="image-upload" accept="image/*">
          </div>

          <div class="prompt-section">
            <label for="prompt">プロンプト (オプション):</label>
            <input type="text" id="prompt" placeholder="3Dモデルの説明を入力してください">
          </div>

          <div class="controls">
            <button id="generate-btn" disabled>3Dモデル生成</button>
          </div>

          <div class="status" id="status"></div>
        </div>
      </div>
    `;

    this.fileInput = this.container.querySelector('#image-upload') as HTMLInputElement;
    this.promptInput = this.container.querySelector('#prompt') as HTMLInputElement;
    this.generateButton = this.container.querySelector('#generate-btn') as HTMLButtonElement;
    this.statusDiv = this.container.querySelector('#status') as HTMLDivElement;
    this.canvas = this.container.querySelector('#model-canvas') as HTMLCanvasElement;
  }

  private setupEventListeners(): void {
    const apiKeyInput = this.container.querySelector('#api-key') as HTMLInputElement;

    // Initialize with default API key
    this.stabilityAPI = null;
    this.updateGenerateButton();

    apiKeyInput.addEventListener('input', () => {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        this.stabilityAPI = new StabilityAPI(apiKey);
        this.updateGenerateButton();
      } else {
        this.stabilityAPI = null;
        this.generateButton.disabled = true;
      }
    });

    this.fileInput.addEventListener('change', () => {
      this.updateGenerateButton();
    });

    this.generateButton.addEventListener('click', () => {
      this.generate3DModel();
    });

    // Initialize model viewer
    this.modelViewer = new ModelViewer(this.canvas);

    // Set canvas size to fill container
    setTimeout(() => {
      const container = this.canvas.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width, 800);
        const height = Math.max(rect.height, 500);

        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.modelViewer!.resize(width, height);
        console.log('Canvas resized to:', width, 'x', height);
      }
    }, 500);
  }

  private updateGenerateButton(): void {
    const hasApiKey = this.stabilityAPI !== null;
    const hasImage = this.fileInput.files && this.fileInput.files.length > 0;
    this.generateButton.disabled = !(hasApiKey && hasImage);
  }

  private async generate3DModel(): Promise<void> {
    if (!this.stabilityAPI || !this.fileInput.files || this.fileInput.files.length === 0) {
      console.log('Missing API or file');
      return;
    }

    const imageFile = this.fileInput.files[0];
    const prompt = this.promptInput.value.trim() || undefined;

    console.log('Starting 3D model generation...');
    this.setStatus('3Dモデルを生成中...', 'info');
    this.generateButton.disabled = true;

    try {
      console.log('Calling StabilityAPI...');
      const modelBlob = await this.stabilityAPI.generateImageTo3D(imageFile, prompt);
      console.log('Got blob from API:', modelBlob);

      console.log('Loading model into viewer...');
      await this.modelViewer!.loadModel(modelBlob);

      this.setStatus('3Dモデルが正常に生成されました！', 'success');
    } catch (error) {
      console.error('3Dモデル生成エラー:', error);
      this.setStatus(`エラー: ${error instanceof Error ? error.message : '不明なエラーが発生しました'}`, 'error');
    } finally {
      this.generateButton.disabled = false;
    }
  }

  private setStatus(message: string, type: 'info' | 'success' | 'error'): void {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
  }

  public resize(width: number, height: number): void {
    if (this.modelViewer) {
      this.modelViewer.resize(width, height);
    }
  }

  public dispose(): void {
    if (this.modelViewer) {
      this.modelViewer.dispose();
    }
  }
}
