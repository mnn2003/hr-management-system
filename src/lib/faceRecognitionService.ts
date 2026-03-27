import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';

let modelsLoaded = false;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  
  modelsLoaded = true;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Detect a single face and return its descriptor (128-d float array).
 */
export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null> {
  const result = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  
  return result || null;
}

/**
 * Detect all faces in a frame.
 */
export async function detectAllFaces(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
) {
  return faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
}

/**
 * Convert a Float32Array descriptor to a plain number array for Firestore storage.
 */
export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

/**
 * Convert a stored number array back to a Float32Array.
 */
export function arrayToDescriptor(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

/**
 * Match a face descriptor against a set of known descriptors.
 * Returns the best match label and distance, or null if no match found.
 */
export function matchFace(
  descriptor: Float32Array,
  knownFaces: { label: string; descriptors: Float32Array[] }[],
  threshold: number = 0.6
): { label: string; distance: number } | null {
  if (knownFaces.length === 0) return null;

  const labeledDescriptors = knownFaces.map(
    (kf) => new faceapi.LabeledFaceDescriptors(kf.label, kf.descriptors)
  );

  const matcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  const bestMatch = matcher.findBestMatch(descriptor);

  if (bestMatch.label === 'unknown') return null;
  return { label: bestMatch.label, distance: bestMatch.distance };
}
