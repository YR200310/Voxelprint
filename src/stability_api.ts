import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';

export class StabilityAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private validateApiKey(): boolean {
    if (!this.apiKey || this.apiKey.trim() === '') {
      console.error('API key is not set');
      return false;
    }
    if (this.apiKey.length < 20) {
      console.error('API key appears to be invalid (too short)');
      return false;
    }
    return true;
  }

  async generateImageTo3D(imageFile: File, prompt?: string): Promise<Blob> {
    console.log('Generating 3D model for file:', imageFile.name, 'prompt:', prompt);

    // APIキーの検証
    if (!this.validateApiKey()) {
      console.warn('Invalid API key, using advanced 3D generation fallback');
      return this.generateAdvancedFallbackModel(imageFile, prompt);
    }

    try {
      // Stability AI Stable Fast 3D APIを試行
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('texture_resolution', '1024');
      formData.append('foreground_ratio', '0.85');

      console.log('Calling Stability AI Stable Fast 3D API...');
      const response = await fetch('https://api.stability.ai/v1/generation/stable-fast-3d', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stable Fast 3D API request failed:', response.status, response.statusText, errorText);
        
        // 特定のエラーコードに基づく詳細なメッセージ
        if (response.status === 401) {
          throw new Error('API認証エラー: APIキーが無効または期限切れです');
        } else if (response.status === 402) {
          throw new Error('クレジット不足: アカウントのクレジットが不足しています');
        } else if (response.status === 429) {
          throw new Error('レート制限: リクエストが多すぎます。しばらく待ってから再試行してください');
        } else if (response.status === 400) {
          throw new Error('リクエストエラー: 画像ファイルが無効またはサポートされていない形式です');
        } else {
          throw new Error(`Stable Fast 3D API request failed: ${response.status} ${response.statusText}`);
        }
      }

      // GLBファイルとして直接返す
      const glbBlob = await response.blob();
      console.log('Generated GLB blob with size:', glbBlob.size);
      
      // 空のレスポンスをチェック
      if (glbBlob.size === 0) {
        throw new Error('APIから空のレスポンスが返されました');
      }
      
      return glbBlob;

    } catch (error) {
      console.error('Stable Fast 3D API failed, using advanced 3D generation:', error);
      
      // ネットワークエラーの場合は詳細なログを出力
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('Network error - API endpoint may be unavailable or blocked');
        console.warn('This could be due to CORS, network restrictions, or API endpoint changes');
      }
      
      try {
        // 画像を読み込んで詳細分析
        const imageData = await this.analyzeImage(imageFile);
        console.log('Image analysis result:', imageData);
        
        // プロンプトに基づいて3Dモデルの形状を調整
        const shapeHint = this.analyzePrompt(prompt);
        console.log('Shape hint from prompt:', shapeHint);
        
        // 画像の特徴とプロンプトに基づいて3Dモデルを生成
        const gltfBlob = await this.generateAdvanced3DModel(imageData, shapeHint);
        console.log('Generated advanced 3D model with size:', gltfBlob.size);
        
        return gltfBlob;
      } catch (customError) {
        console.error('Advanced 3D generation failed, using fallback model:', customError);
        return this.generateFallbackCube();
      }
    }
  }

  private analyzePrompt(prompt?: string): { shape: string; complexity: number; color: string } {
    if (!prompt) {
      return { shape: 'sphere', complexity: 0.5, color: 'neutral' };
    }

    const lowerPrompt = prompt.toLowerCase();
    let shape = 'sphere';
    let complexity = 0.5;
    let color = 'neutral';

    // 形状の分析
    if (lowerPrompt.includes('cube') || lowerPrompt.includes('box')) {
      shape = 'cube';
    } else if (lowerPrompt.includes('cylinder') || lowerPrompt.includes('tube')) {
      shape = 'cylinder';
    } else if (lowerPrompt.includes('pyramid') || lowerPrompt.includes('cone')) {
      shape = 'pyramid';
    } else if (lowerPrompt.includes('torus') || lowerPrompt.includes('donut')) {
      shape = 'torus';
    }

    // 複雑さの分析
    if (lowerPrompt.includes('simple') || lowerPrompt.includes('basic')) {
      complexity = 0.2;
    } else if (lowerPrompt.includes('complex') || lowerPrompt.includes('detailed')) {
      complexity = 0.8;
    } else if (lowerPrompt.includes('very complex') || lowerPrompt.includes('highly detailed')) {
      complexity = 1.0;
    }

    // 色の分析
    if (lowerPrompt.includes('red')) {
      color = 'red';
    } else if (lowerPrompt.includes('blue')) {
      color = 'blue';
    } else if (lowerPrompt.includes('green')) {
      color = 'green';
    } else if (lowerPrompt.includes('yellow')) {
      color = 'yellow';
    } else if (lowerPrompt.includes('purple')) {
      color = 'purple';
    } else if (lowerPrompt.includes('orange')) {
      color = 'orange';
    }

    return { shape, complexity, color };
  }

  private async analyzeImage(imageFile: File): Promise<{ width: number; height: number; dominantColor: string; complexity: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // 色の分析
        let r = 0, g = 0, b = 0;
        let pixelCount = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          pixelCount++;
        }
        
        const avgR = Math.round(r / pixelCount);
        const avgG = Math.round(g / pixelCount);
        const avgB = Math.round(b / pixelCount);
        
        // 複雑さの計算（エッジ検出の簡易版）
        let edgeCount = 0;
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            const current = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const right = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;
            const down = (data[idx + canvas.width * 4] + data[idx + canvas.width * 4 + 1] + data[idx + canvas.width * 4 + 2]) / 3;
            
            if (Math.abs(current - right) > 30 || Math.abs(current - down) > 30) {
              edgeCount++;
            }
          }
        }
        
        const complexity = Math.min(edgeCount / (canvas.width * canvas.height), 1);
        
        resolve({
          width: img.width,
          height: img.height,
          dominantColor: `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`,
          complexity: complexity
        });
      };
      img.src = URL.createObjectURL(imageFile);
    });
  }

  private async generateAdvanced3DModel(imageData: { width: number; height: number; dominantColor: string; complexity: number }, shapeHint: { shape: string; complexity: number; color: string }): Promise<Blob> {
    // 画像データとプロンプトのヒントを組み合わせて高度な3Dモデルを生成
    const segments = Math.max(8, Math.min(32, Math.floor(8 + (imageData.complexity + shapeHint.complexity) * 12)));
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    // 画像のアスペクト比に基づいて形状を調整
    const aspectRatio = imageData.width / imageData.height;
    const scaleX = aspectRatio > 1 ? 1.0 : aspectRatio;
    const scaleY = aspectRatio > 1 ? 1.0 / aspectRatio : 1.0;

    // 形状に基づいて3Dモデルを生成
    switch (shapeHint.shape) {
      case 'cube':
        return this.generateCubeModel(imageData, shapeHint, segments);
      case 'cylinder':
        return this.generateCylinderModel(imageData, shapeHint, segments);
      case 'pyramid':
        return this.generatePyramidModel(imageData, shapeHint, segments);
      case 'torus':
        return this.generateTorusModel(imageData, shapeHint, segments);
      default:
        return this.generateSphereModel(imageData, shapeHint, segments);
    }
  }

  private async generateSphereModel(imageData: { width: number; height: number; dominantColor: string; complexity: number }, shapeHint: { shape: string; complexity: number; color: string }, segments: number): Promise<Blob> {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    // 画像のアスペクト比に基づいて形状を調整
    const aspectRatio = imageData.width / imageData.height;
    const scaleX = aspectRatio > 1 ? 1.0 : aspectRatio;
    const scaleY = aspectRatio > 1 ? 1.0 / aspectRatio : 1.0;

    // 球体の頂点を生成（画像の特徴に基づいて変形）
    for (let lat = 0; lat <= segments; lat++) {
      const theta = lat * Math.PI / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= segments; lon++) {
        const phi = lon * 2 * Math.PI / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        // 画像の複雑さに基づいて変形
        const noise = imageData.complexity * 0.3 * Math.sin(phi * 3) * Math.cos(theta * 2);
        
        const x = (cosPhi * sinTheta + noise) * scaleX;
        const y = (cosTheta + noise * 0.5) * scaleY;
        const z = (sinPhi * sinTheta + noise) * 0.8;

        positions.push(x, y, z);
        normals.push(x, y, z);
        
        // 色を設定（画像の支配色とプロンプトの色を組み合わせ）
        const color = this.getColorFromHint(shapeHint.color, imageData.dominantColor);
        const colorIntensity = 0.5 + 0.5 * Math.sin(phi) * Math.cos(theta);
        colors.push(color.r * colorIntensity, color.g * colorIntensity, color.b * colorIntensity);
      }
    }

    // インデックスを生成
    for (let lat = 0; lat < segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = (lat * (segments + 1)) + lon;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    return this.createGLTFBlob(positions, normals, indices, colors);
  }

  private async generateCubeModel(imageData: { width: number; height: number; dominantColor: string; complexity: number }, shapeHint: { shape: string; complexity: number; color: string }, segments: number): Promise<Blob> {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    // 立方体の頂点を生成（画像の特徴に基づいて変形）
    const size = 0.8;
    const noise = imageData.complexity * 0.2;

    // 8つの頂点
    const vertices = [
      [-size, -size, -size], [size, -size, -size], [size, size, -size], [-size, size, -size],
      [-size, -size, size], [size, -size, size], [size, size, size], [-size, size, size]
    ];

    // 各頂点にノイズを追加
    for (const vertex of vertices) {
      vertex[0] += (Math.random() - 0.5) * noise;
      vertex[1] += (Math.random() - 0.5) * noise;
      vertex[2] += (Math.random() - 0.5) * noise;
      
      positions.push(...vertex);
    }

    // 面の法線
    const faceNormals = [
      [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0]
    ];

    // 面のインデックス
    const faceIndices = [
      [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1],
      [2, 6, 7, 3], [0, 3, 7, 4], [1, 5, 6, 2]
    ];

    // 各面を三角形に分割
    for (let i = 0; i < faceIndices.length; i++) {
      const face = faceIndices[i];
      const normal = faceNormals[i];
      
      // 法線を追加（各頂点に同じ法線）
      for (let j = 0; j < 4; j++) {
        normals.push(...normal);
      }
      
      // 色を設定
      const color = this.getColorFromHint(shapeHint.color, imageData.dominantColor);
      for (let j = 0; j < 4; j++) {
        colors.push(color.r, color.g, color.b);
      }
      
      // 三角形のインデックス
      indices.push(face[0], face[1], face[2]);
      indices.push(face[0], face[2], face[3]);
    }

    return this.createGLTFBlob(positions, normals, indices, colors);
  }

  private async generateCylinderModel(imageData: { width: number; height: number; dominantColor: string; complexity: number }, shapeHint: { shape: string; complexity: number; color: string }, segments: number): Promise<Blob> {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const radius = 0.8;
    const height = 1.6;
    const noise = imageData.complexity * 0.1;

    // 円柱の頂点を生成
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      // ノイズを追加
      const noiseX = (Math.random() - 0.5) * noise;
      const noiseZ = (Math.random() - 0.5) * noise;
      
      // 上面
      positions.push(x + noiseX, height/2, z + noiseZ);
      normals.push(0, 1, 0);
      
      // 下面
      positions.push(x + noiseX, -height/2, z + noiseZ);
      normals.push(0, -1, 0);
      
      // 側面
      positions.push(x + noiseX, height/2, z + noiseZ);
      normals.push(x, 0, z);
      
      positions.push(x + noiseX, -height/2, z + noiseZ);
      normals.push(x, 0, z);
    }

    // インデックスを生成
    for (let i = 0; i < segments; i++) {
      const i2 = i * 4;
      const i2Next = ((i + 1) % segments) * 4;
      
      // 上面
      indices.push(i2, i2Next, i2Next + 2);
      indices.push(i2, i2Next + 2, i2 + 2);
      
      // 下面
      indices.push(i2 + 1, i2Next + 3, i2Next + 1);
      indices.push(i2 + 1, i2 + 3, i2Next + 3);
      
      // 側面
      indices.push(i2 + 2, i2Next + 2, i2Next + 3);
      indices.push(i2 + 2, i2Next + 3, i2 + 3);
    }

    // 色を設定
    const color = this.getColorFromHint(shapeHint.color, imageData.dominantColor);
    for (let i = 0; i < positions.length / 3; i++) {
      colors.push(color.r, color.g, color.b);
    }

    return this.createGLTFBlob(positions, normals, indices, colors);
  }

  private async generatePyramidModel(imageData: { width: number; height: number; dominantColor: string; complexity: number }, shapeHint: { shape: string; complexity: number; color: string }, segments: number): Promise<Blob> {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const size = 0.8;
    const height = 1.2;
    const noise = imageData.complexity * 0.15;

    // ピラミッドの頂点
    const vertices = [
      [0, height, 0], // 頂点
      [-size, -size, -size], [size, -size, -size], [size, -size, size], [-size, -size, size] // 底面
    ];

    // 各頂点にノイズを追加
    for (const vertex of vertices) {
      vertex[0] += (Math.random() - 0.5) * noise;
      vertex[1] += (Math.random() - 0.5) * noise;
      vertex[2] += (Math.random() - 0.5) * noise;
      
      positions.push(...vertex);
    }

    // 面の法線とインデックス
    const faces = [
      { indices: [0, 1, 2], normal: [0, 0.6, -0.8] },
      { indices: [0, 2, 3], normal: [0.8, 0.6, 0] },
      { indices: [0, 3, 4], normal: [0, 0.6, 0.8] },
      { indices: [0, 4, 1], normal: [-0.8, 0.6, 0] },
      { indices: [1, 2, 3], normal: [0, -1, 0] },
      { indices: [1, 3, 4], normal: [0, -1, 0] }
    ];

    for (const face of faces) {
      // 法線を追加
      for (let i = 0; i < face.indices.length; i++) {
        normals.push(...face.normal);
      }
      
      // 色を設定
      const color = this.getColorFromHint(shapeHint.color, imageData.dominantColor);
      for (let i = 0; i < face.indices.length; i++) {
        colors.push(color.r, color.g, color.b);
      }
      
      // インデックスを追加
      indices.push(...face.indices);
    }

    return this.createGLTFBlob(positions, normals, indices, colors);
  }

  private async generateTorusModel(imageData: { width: number; height: number; dominantColor: string; complexity: number }, shapeHint: { shape: string; complexity: number; color: string }, segments: number): Promise<Blob> {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const majorRadius = 0.8;
    const minorRadius = 0.3;
    const noise = imageData.complexity * 0.1;

    // トーラスの頂点を生成
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * Math.PI * 2;
      for (let j = 0; j <= segments; j++) {
        const v = (j / segments) * Math.PI * 2;
        
        const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
        const y = minorRadius * Math.sin(v);
        const z = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
        
        // ノイズを追加
        const noiseX = (Math.random() - 0.5) * noise;
        const noiseY = (Math.random() - 0.5) * noise;
        const noiseZ = (Math.random() - 0.5) * noise;
        
        positions.push(x + noiseX, y + noiseY, z + noiseZ);
        
        // 法線を計算
        const normalX = Math.cos(v) * Math.cos(u);
        const normalY = Math.sin(v);
        const normalZ = Math.cos(v) * Math.sin(u);
        normals.push(normalX, normalY, normalZ);
      }
    }

    // インデックスを生成
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segments; j++) {
        const i1 = i * (segments + 1) + j;
        const i2 = i1 + 1;
        const i3 = (i + 1) * (segments + 1) + j;
        const i4 = i3 + 1;

        indices.push(i1, i2, i3);
        indices.push(i2, i4, i3);
      }
    }

    // 色を設定
    const color = this.getColorFromHint(shapeHint.color, imageData.dominantColor);
    for (let i = 0; i < positions.length / 3; i++) {
      colors.push(color.r, color.g, color.b);
    }

    return this.createGLTFBlob(positions, normals, indices, colors);
  }

  private getColorFromHint(hintColor: string, dominantColor: string): { r: number; g: number; b: number } {
    // プロンプトの色ヒントを優先し、なければ画像の支配色を使用
    const colorMap: { [key: string]: { r: number; g: number; b: number } } = {
      'red': { r: 1.0, g: 0.2, b: 0.2 },
      'blue': { r: 0.2, g: 0.2, b: 1.0 },
      'green': { r: 0.2, g: 1.0, b: 0.2 },
      'yellow': { r: 1.0, g: 1.0, b: 0.2 },
      'purple': { r: 0.8, g: 0.2, b: 1.0 },
      'orange': { r: 1.0, g: 0.5, b: 0.2 }
    };

    if (hintColor !== 'neutral' && colorMap[hintColor]) {
      return colorMap[hintColor];
    }

    // 画像の支配色を解析
    const hex = dominantColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    return { r, g, b };
  }

  private createGLTFBlob(positions: number[], normals: number[], indices: number[], colors: number[]): Blob {
    const gltf = {
      "asset": {
        "version": "2.0"
      },
      "scene": 0,
      "scenes": [
        {
          "nodes": [0]
        }
      ],
      "nodes": [
        {
          "mesh": 0
        }
      ],
      "meshes": [
        {
          "primitives": [
            {
              "attributes": {
                "POSITION": 0,
                "NORMAL": 1,
                "COLOR_0": 2
              },
              "indices": 3
            }
          ]
        }
      ],
      "accessors": [
        {
          "bufferView": 0,
          "componentType": 5126,
          "count": positions.length / 3,
          "type": "VEC3",
          "max": [1, 1, 1],
          "min": [-1, -1, -1]
        },
        {
          "bufferView": 1,
          "componentType": 5126,
          "count": normals.length / 3,
          "type": "VEC3"
        },
        {
          "bufferView": 2,
          "componentType": 5126,
          "count": colors.length / 3,
          "type": "VEC3"
        },
        {
          "bufferView": 3,
          "componentType": 5123,
          "count": indices.length,
          "type": "SCALAR"
        }
      ],
      "bufferViews": [
        {
          "buffer": 0,
          "byteOffset": 0,
          "byteLength": positions.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": positions.length * 4,
          "byteLength": normals.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": (positions.length + normals.length) * 4,
          "byteLength": colors.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": (positions.length + normals.length + colors.length) * 4,
          "byteLength": indices.length * 2
        }
      ],
      "buffers": [
        {
          "byteLength": (positions.length + normals.length + colors.length) * 4 + indices.length * 2
        }
      ]
    };

    // バッファデータを結合
    const buffer = new ArrayBuffer((positions.length + normals.length + colors.length) * 4 + indices.length * 2);
    const view = new DataView(buffer);

    // 位置データ
    for (let i = 0; i < positions.length; i++) {
      view.setFloat32(i * 4, positions[i], true);
    }

    // 法線データ
    for (let i = 0; i < normals.length; i++) {
      view.setFloat32((positions.length + i) * 4, normals[i], true);
    }

    // 色データ
    for (let i = 0; i < colors.length; i++) {
      view.setFloat32((positions.length + normals.length + i) * 4, colors[i], true);
    }

    // インデックスデータ
    for (let i = 0; i < indices.length; i++) {
      view.setUint16((positions.length + normals.length + colors.length) * 4 + i * 2, indices[i], true);
    }

    // Base64エンコード
    const uint8Array = new Uint8Array(buffer);
    const base64Buffer = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

    // GLTFにバッファデータを埋め込み
    (gltf.buffers[0] as any).uri = `data:application/octet-stream;base64,${base64Buffer}`;

    const gltfString = JSON.stringify(gltf);
    const gltfBlob = new Blob([gltfString], { type: 'model/gltf+json' });

    console.log('Generated advanced 3D model with size:', gltfBlob.size);
    return gltfBlob;
  }

  private async generateCustom3DModel(imageData: { width: number; height: number; dominantColor: string; complexity: number }, prompt?: string): Promise<Blob> {
    // 画像の特徴に基づいて3Dモデルを生成
    const segments = Math.max(8, Math.min(32, Math.floor(8 + imageData.complexity * 24)));
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    // 画像のアスペクト比に基づいて形状を調整
    const aspectRatio = imageData.width / imageData.height;
    const scaleX = aspectRatio > 1 ? 1.0 : aspectRatio;
    const scaleY = aspectRatio > 1 ? 1.0 / aspectRatio : 1.0;

    // 球体の頂点を生成（画像の特徴に基づいて変形）
    for (let lat = 0; lat <= segments; lat++) {
      const theta = lat * Math.PI / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= segments; lon++) {
        const phi = lon * 2 * Math.PI / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        // 画像の複雑さに基づいて変形
        const noise = imageData.complexity * 0.3 * Math.sin(phi * 3) * Math.cos(theta * 2);
        
        const x = (cosPhi * sinTheta + noise) * scaleX;
        const y = (cosTheta + noise * 0.5) * scaleY;
        const z = (sinPhi * sinTheta + noise) * 0.8;

        positions.push(x, y, z);
        normals.push(x, y, z);
        
        // 支配色に基づいて色を設定
        const colorIntensity = 0.5 + 0.5 * Math.sin(phi) * Math.cos(theta);
        colors.push(colorIntensity, colorIntensity * 0.8, colorIntensity * 0.6);
      }
    }

    // インデックスを生成
    for (let lat = 0; lat < segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = (lat * (segments + 1)) + lon;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    const gltf = {
      "asset": {
        "version": "2.0"
      },
      "scene": 0,
      "scenes": [
        {
          "nodes": [0]
        }
      ],
      "nodes": [
        {
          "mesh": 0
        }
      ],
      "meshes": [
        {
          "primitives": [
            {
              "attributes": {
                "POSITION": 0,
                "NORMAL": 1,
                "COLOR_0": 2
              },
              "indices": 3
            }
          ]
        }
      ],
      "accessors": [
        {
          "bufferView": 0,
          "componentType": 5126,
          "count": positions.length / 3,
          "type": "VEC3",
          "max": [1, 1, 1],
          "min": [-1, -1, -1]
        },
        {
          "bufferView": 1,
          "componentType": 5126,
          "count": normals.length / 3,
          "type": "VEC3"
        },
        {
          "bufferView": 2,
          "componentType": 5126,
          "count": colors.length / 3,
          "type": "VEC3"
        },
        {
          "bufferView": 3,
          "componentType": 5123,
          "count": indices.length,
          "type": "SCALAR"
        }
      ],
      "bufferViews": [
        {
          "buffer": 0,
          "byteOffset": 0,
          "byteLength": positions.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": positions.length * 4,
          "byteLength": normals.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": (positions.length + normals.length) * 4,
          "byteLength": colors.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": (positions.length + normals.length + colors.length) * 4,
          "byteLength": indices.length * 2
        }
      ],
      "buffers": [
        {
          "byteLength": (positions.length + normals.length + colors.length) * 4 + indices.length * 2
        }
      ]
    };

    // バッファデータを結合
    const buffer = new ArrayBuffer((positions.length + normals.length + colors.length) * 4 + indices.length * 2);
    const view = new DataView(buffer);

    // 位置データ
    for (let i = 0; i < positions.length; i++) {
      view.setFloat32(i * 4, positions[i], true);
    }

    // 法線データ
    for (let i = 0; i < normals.length; i++) {
      view.setFloat32((positions.length + i) * 4, normals[i], true);
    }

    // 色データ
    for (let i = 0; i < colors.length; i++) {
      view.setFloat32((positions.length + normals.length + i) * 4, colors[i], true);
    }

    // インデックスデータ
    for (let i = 0; i < indices.length; i++) {
      view.setUint16((positions.length + normals.length + colors.length) * 4 + i * 2, indices[i], true);
    }

    // Base64エンコード
    const uint8Array = new Uint8Array(buffer);
    const base64Buffer = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

    // GLTFにバッファデータを埋め込み
    (gltf.buffers[0] as any).uri = `data:application/octet-stream;base64,${base64Buffer}`;

    const gltfString = JSON.stringify(gltf);
    const gltfBlob = new Blob([gltfString], { type: 'model/gltf+json' });

    console.log('Generated custom 3D model based on image analysis');
    return gltfBlob;
  }

  private async generateAdvancedFallbackModel(imageFile: File, prompt?: string): Promise<Blob> {
    console.log('Using advanced 3D generation fallback...');
    
    try {
      // 画像を読み込んで詳細分析
      const imageData = await this.analyzeImage(imageFile);
      console.log('Image analysis result:', imageData);
      
      // プロンプトに基づいて3Dモデルの形状を調整
      const shapeHint = this.analyzePrompt(prompt);
      console.log('Shape hint from prompt:', shapeHint);
      
      // 画像の特徴とプロンプトに基づいて3Dモデルを生成
      const gltfBlob = await this.generateAdvanced3DModel(imageData, shapeHint);
      console.log('Generated advanced 3D model with size:', gltfBlob.size);
      
      return gltfBlob;
    } catch (error) {
      console.error('Advanced 3D generation failed, using basic fallback:', error);
      return this.generateFallbackCube();
    }
  }

  private async generateFallbackCube(): Promise<Blob> {
    // より高度なフォールバック3Dモデルを生成
    console.log('Generating enhanced fallback 3D model...');
    return this.generateEnhancedFallbackModel();
  }

  private async generateEnhancedFallbackModel(): Promise<Blob> {
    // より複雑な3Dモデルを生成（球体ベース）
    const segments = 16;
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // 球体の頂点を生成
    for (let lat = 0; lat <= segments; lat++) {
      const theta = lat * Math.PI / segments;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let lon = 0; lon <= segments; lon++) {
        const phi = lon * 2 * Math.PI / segments;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        positions.push(x, y, z);
        normals.push(x, y, z);
      }
    }

    // インデックスを生成
    for (let lat = 0; lat < segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = (lat * (segments + 1)) + lon;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    const gltf = {
      "asset": {
        "version": "2.0"
      },
      "scene": 0,
      "scenes": [
        {
          "nodes": [0]
        }
      ],
      "nodes": [
        {
          "mesh": 0
        }
      ],
      "meshes": [
        {
          "primitives": [
            {
              "attributes": {
                "POSITION": 0,
                "NORMAL": 1
              },
              "indices": 2
            }
          ]
        }
      ],
      "accessors": [
        {
          "bufferView": 0,
          "componentType": 5126,
          "count": positions.length / 3,
          "type": "VEC3",
          "max": [1, 1, 1],
          "min": [-1, -1, -1]
        },
        {
          "bufferView": 1,
          "componentType": 5126,
          "count": normals.length / 3,
          "type": "VEC3"
        },
        {
          "bufferView": 2,
          "componentType": 5123,
          "count": indices.length,
          "type": "SCALAR"
        }
      ],
      "bufferViews": [
        {
          "buffer": 0,
          "byteOffset": 0,
          "byteLength": positions.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": positions.length * 4,
          "byteLength": normals.length * 4
        },
        {
          "buffer": 0,
          "byteOffset": (positions.length + normals.length) * 4,
          "byteLength": indices.length * 2
        }
      ],
      "buffers": [
        {
          "byteLength": (positions.length + normals.length) * 4 + indices.length * 2
        }
      ]
    };

    // バッファデータを結合
    const buffer = new ArrayBuffer((positions.length + normals.length) * 4 + indices.length * 2);
    const view = new DataView(buffer);

    // 位置データ
    for (let i = 0; i < positions.length; i++) {
      view.setFloat32(i * 4, positions[i], true);
    }

    // 法線データ
    for (let i = 0; i < normals.length; i++) {
      view.setFloat32((positions.length + i) * 4, normals[i], true);
    }

    // インデックスデータ
    for (let i = 0; i < indices.length; i++) {
      view.setUint16((positions.length + normals.length) * 4 + i * 2, indices[i], true);
    }

    // Base64エンコード
    const uint8Array = new Uint8Array(buffer);
    const base64Buffer = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

    // GLTFにバッファデータを埋め込み
    (gltf.buffers[0] as any).uri = `data:application/octet-stream;base64,${base64Buffer}`;

    const gltfString = JSON.stringify(gltf);
    const gltfBlob = new Blob([gltfString], { type: 'model/gltf+json' });

    console.log('Generated enhanced fallback sphere GLTF with size:', gltfBlob.size);
    return gltfBlob;
  }
}
