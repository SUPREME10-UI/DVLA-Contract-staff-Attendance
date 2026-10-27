export interface FaceFeatures {
  descriptor?: number[]; // 128-point face-api.js descriptor (preferred, most accurate)
  dhash?: string;        // legacy fallback
  blocks?: number[];     // legacy fallback
  color?: [number, number, number]; // legacy fallback
}

export function parseFaceFeatures(features: unknown): FaceFeatures | null {
  let parsed = features;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const descriptor = (parsed as FaceFeatures).descriptor;
  if (!(Array.isArray(descriptor) &&
    descriptor.length === 128 &&
    descriptor.every((value) => Number.isFinite(value)))) return null;
  return parsed as FaceFeatures;
}

export function hasValidFaceDescriptor(features: unknown): features is FaceFeatures {
  return parseFaceFeatures(features) !== null;
}

/**
 * Computes Euclidean distance between two 128-d face-api.js descriptors.
 * In face-api.js (dlib ResNet-34 model):
 * - Same person typically: 0.15 - 0.42
 * - Different persons typically: 0.52 - 0.85+
 */
export function computeEuclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== 128 || b.length !== 128) return Infinity;
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return Infinity;
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Converts the face-api descriptor's Euclidean distance into a 0..1 score. */
export function compareDescriptors(a: number[], b: number[]): number {
  const dist = computeEuclideanDistance(a, b);
  if (!Number.isFinite(dist)) return 0;
  return Math.max(0, 1 - dist);
}

/**
 * Legacy: Compares two facial feature vectors (dHash + blocks + color) and returns a similarity score from 0.0 to 1.0
 */
export function compareFaceFeatures(a: FaceFeatures, b: FaceFeatures): number {
  if (!a || !b) return 0;

  // Prefer modern 128-point descriptor comparison
  if (a.descriptor && b.descriptor && a.descriptor.length > 0 && b.descriptor.length > 0) {
    return compareDescriptors(a.descriptor, b.descriptor);
  }

  // Legacy: dHash + blocks + color
  if (!a.dhash || !b.dhash || !a.blocks || !b.blocks || !a.color || !b.color) return 0;

  // 1. dHash Hamming Similarity (out of 56 bits)
  let matchingBits = 0;
  const hashLen = Math.min(a.dhash.length, b.dhash.length);
  if (hashLen > 0) {
    for (let i = 0; i < hashLen; i++) {
      if (a.dhash[i] === b.dhash[i]) matchingBits++;
    }
  }
  const hashSim = hashLen > 0 ? matchingBits / hashLen : 0;

  // 2. Block Luminance Correlation (Normalized 64 blocks)
  let blockDiffSum = 0;
  const numBlocks = Math.min(a.blocks.length, b.blocks.length, 64);
  if (numBlocks > 0) {
    for (let i = 0; i < numBlocks; i++) {
      blockDiffSum += Math.abs((a.blocks[i] || 0) - (b.blocks[i] || 0));
    }
  }
  const avgBlockDiff = numBlocks > 0 ? blockDiffSum / numBlocks : 255;
  const blockSim = Math.max(0, 1 - avgBlockDiff / 90);

  // 3. Color profile similarity (Euclidean distance on RGB)
  const dr = (a.color[0] || 0) - (b.color[0] || 0);
  const dg = (a.color[1] || 0) - (b.color[1] || 0);
  const db = (a.color[2] || 0) - (b.color[2] || 0);
  const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
  const colorSim = Math.max(0, 1 - colorDist / 120);

  // Weighted score: 50% structural dHash, 35% luminance profile, 15% skin color
  return hashSim * 0.50 + blockSim * 0.35 + colorSim * 0.15;
}

/**
 * Maximum Euclidean distance allowable for positive face identification.
 * 0.45 is the recognized standard for 1:N biometric search to strictly reject strangers.
 */
export const DEFAULT_MAX_DESCRIPTOR_DISTANCE = 0.45;

/**
 * Searches enrolled staff descriptors for an authentic match.
 * Uses Euclidean distance between 128-point face descriptors.
 *
 * If the minimum distance found exceeds maxDistance (0.45), this face belongs
 * to an unregistered / unrecognized individual and NULL is returned.
 */
export function findBestFaceMatch(
  incomingFeatures: FaceFeatures | null | undefined,
  candidateStaffList: any[],
  maxDistanceOrThreshold: number = DEFAULT_MAX_DESCRIPTOR_DISTANCE
): { staff: any; score: number; distance: number } | null {
  if (
    !hasValidFaceDescriptor(incomingFeatures) ||
    !candidateStaffList ||
    candidateStaffList.length === 0
  ) return null;
  const incomingDescriptor = incomingFeatures.descriptor;
  if (!incomingDescriptor) return null;

  // Resolve cutoff distance:
  // If a caller passes e.g. 0.4 or 0.45, treat as distance limit.
  // Default is 0.45.
  const maxDistance = typeof maxDistanceOrThreshold === "number" && maxDistanceOrThreshold > 0 && maxDistanceOrThreshold <= 0.50
    ? maxDistanceOrThreshold
    : DEFAULT_MAX_DESCRIPTOR_DISTANCE;

  let bestMatch: any = null;
  let lowestDistance = Infinity;

  for (const staff of candidateStaffList) {
    if (staff.face_features) {
      try {
        const storedFeatures: FaceFeatures = typeof staff.face_features === "string"
          ? JSON.parse(staff.face_features)
          : staff.face_features;
        if (storedFeatures?.descriptor?.length === 128) {
          const distance = computeEuclideanDistance(incomingDescriptor, storedFeatures.descriptor);
          if (distance < lowestDistance) {
            lowestDistance = distance;
            bestMatch = staff;
          }
        }
      } catch (err) {
        console.warn("Failed parsing face_features for staff:", staff.id, err);
      }
    }
  }

  console.log(
    `[FaceMatcher] Lowest Euclidean distance: ${lowestDistance === Infinity ? "N/A" : lowestDistance.toFixed(3)} (required <= ${maxDistance.toFixed(3)})`
  );

  // STRICT VERIFICATION: Face must match within the 0.45 cutoff limit.
  // Any distance above maxDistance means this face is NOT the enrolled staff member!
  if (bestMatch && lowestDistance <= maxDistance) {
    // Map distance [0 .. maxDistance] to confidence score [100% .. 70%]
    const ratio = lowestDistance / maxDistance;
    const confidence = Math.max(0.70, Math.min(0.99, 1.0 - (ratio * 0.30)));
    return { staff: bestMatch, score: confidence, distance: lowestDistance };
  }

  // Not recognized — unregistered face
  return null;
}

/**
 * Extract robust 64-block perceptual luminance & 56-bit dHash & color profile from canvas.
 * Client-side canvas helper.
 */
export function extractCanvasVisualFeatures(canvas: HTMLCanvasElement): {
  dhash: string;
  blocks: number[];
  color: [number, number, number];
} {
  try {
    const size = 32;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = size;
    tempCanvas.height = size;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) {
      return { dhash: "1".repeat(56), blocks: Array(64).fill(128), color: [128, 128, 128] };
    }

    ctx.drawImage(canvas, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size).data;

    // 8x8 luminance blocks (64 values)
    const blocks: number[] = [];
    const blockSize = 4;
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 8; bx++) {
        let sum = 0;
        for (let y = 0; y < blockSize; y++) {
          for (let x = 0; x < blockSize; x++) {
            const px = ((by * blockSize + y) * size + (bx * blockSize + x)) * 4;
            const r = imgData[px];
            const g = imgData[px + 1];
            const b = imgData[px + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            sum += lum;
          }
        }
        blocks.push(Math.round(sum / (blockSize * blockSize)));
      }
    }

    // 56-bit dHash (difference hash)
    let dhash = "";
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 8; c++) {
        const left = blocks[r * 8 + c];
        const right = blocks[(r + 1) * 8 + c];
        dhash += left > right ? "1" : "0";
      }
    }

    // Average color (R, G, B)
    let rSum = 0, gSum = 0, bSum = 0;
    const totalPixels = size * size;
    for (let i = 0; i < totalPixels; i++) {
      rSum += imgData[i * 4];
      gSum += imgData[i * 4 + 1];
      bSum += imgData[i * 4 + 2];
    }
    const color: [number, number, number] = [
      Math.round(rSum / totalPixels),
      Math.round(gSum / totalPixels),
      Math.round(bSum / totalPixels)
    ];

    return { dhash, blocks, color };
  } catch {
    return { dhash: "1".repeat(56), blocks: Array(64).fill(128), color: [128, 128, 128] };
  }
}

