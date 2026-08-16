import dracoDecoderSource from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?raw';
import { DRACOLoader, type GLTFLoader } from 'three-stdlib';

class BundledDracoLoader extends DRACOLoader {
  _loadLibrary(url: string, responseType: string): Promise<string> {
    if (url === 'draco_decoder.js' && responseType === 'text') {
      return Promise.resolve(dracoDecoderSource);
    }

    return Promise.reject(new Error(`Unsupported bundled Draco decoder asset: ${url}`));
  }
}

const dracoLoader = new BundledDracoLoader();
dracoLoader.setDecoderConfig({ type: 'js' });

export function configureDracoLoader(loader: GLTFLoader): void {
  loader.setDRACOLoader(dracoLoader);
}
