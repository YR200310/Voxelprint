import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class ModelViewer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: any;
  private model: THREE.Group | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    const width = Math.max(canvas.clientWidth, 800);
    const height = Math.max(canvas.clientHeight, 500);
    this.camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    console.log('Renderer initialized with size:', width, 'x', height);

    this.setupLighting();
    this.setupControls();
    this.createDefaultCube();
    this.animate();
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Point light
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-10, -10, -5);
    this.scene.add(pointLight);
  }

  private setupControls(): void {
    // Simple orbit controls implementation
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;
    let rotationX = 0;
    let rotationY = 0;

    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', (event) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    canvas.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      if (!isMouseDown) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      targetRotationY += deltaX * 0.01;
      targetRotationX += deltaY * 0.01;

      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    canvas.addEventListener('wheel', (event) => {
      this.camera.position.z += event.deltaY * 0.01;
      this.camera.position.z = Math.max(0.5, Math.min(10, this.camera.position.z));
    });

    // Smooth rotation animation
    const animateRotation = () => {
      rotationX += (targetRotationX - rotationX) * 0.1;
      rotationY += (targetRotationY - rotationY) * 0.1;

      if (this.model) {
        this.model.rotation.x = rotationX;
        this.model.rotation.y = rotationY;
      }

      requestAnimationFrame(animateRotation);
    };
    animateRotation();
  }

  private createDefaultCube(): void {
    const geometry = new THREE.BoxGeometry(2, 2, 2); // より大きく
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // 赤色で目立つように
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;

    this.model = new THREE.Group();
    this.model.add(cube);
    this.model.position.set(0, 0, 0);
    this.scene.add(this.model);

    console.log('Default cube created and added to scene');
    console.log('Scene children count:', this.scene.children.length);
    console.log('Model position:', this.model.position);
    console.log('Camera position:', this.camera.position);
  }

  async loadModel(modelData: ArrayBuffer | Blob): Promise<void> {
    console.log('Loading model with data size:', modelData instanceof ArrayBuffer ? modelData.byteLength : modelData.size);

    // Clear existing model
    if (this.model) {
      this.scene.remove(this.model);
    }

    try {
      // Use GLTFLoader to load the model
      const loader = new GLTFLoader();
      
      // DRACO loader for compressed models
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(dracoLoader);
      
      console.log('Starting model parsing...');
      
      let gltf;
      if (modelData instanceof Blob) {
        // GLBファイルの場合
        const arrayBuffer = await modelData.arrayBuffer();
        gltf = await loader.parseAsync(arrayBuffer, '');
      } else {
        // GLTFファイルの場合
        gltf = await loader.parseAsync(modelData, '');
      }
      
      console.log('Model parsed successfully:', gltf);

      this.model = gltf.scene;
      console.log('Model scene:', this.model);

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.5 / maxDim; // より小さくスケール

      console.log('Model bounds:', { center, size, maxDim, scale });

      this.model.scale.setScalar(scale);
      this.model.position.set(0, 0, 0); // 中央に固定

      // Enable shadows for all meshes
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          console.log('Added mesh:', child);
        }
      });

      this.scene.add(this.model);
      console.log('Model added to scene');
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
