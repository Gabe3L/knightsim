import dracoWasmUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url';
import dracoWasmWrapperSource from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?raw';
import { DRACOLoader, type GLTFLoader } from 'three-stdlib';

class BundledDracoLoader extends DRACOLoader {
  _loadLibrary(url: string, responseType: string): Promise<string | ArrayBuffer> {
    if (url === 'draco_wasm_wrapper.js' && responseType === 'text') {
      return Promise.resolve(dracoWasmWrapperSource);
    }
    if (url === 'draco_decoder.wasm' && responseType === 'arraybuffer') {
      return fetch(dracoWasmUrl).then((response) => {
        if (!response.ok) throw new Error(`Unable to load the bundled Draco decoder (${response.status}).`);
        return response.arrayBuffer();
      });
    }

    return Promise.reject(new Error(`Unsupported bundled Draco decoder asset: ${url}`));
  }
}

const dracoLoader = new BundledDracoLoader();
const availableWorkers = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
  ? navigator.hardwareConcurrency
  : 4;
dracoLoader.setDecoderConfig({ type: 'wasm' });
dracoLoader.setWorkerLimit(Math.min(8, Math.max(2, availableWorkers - 2)));

export function configureDracoLoader(loader: GLTFLoader): void {
  loader.setDRACOLoader(dracoLoader);
}
