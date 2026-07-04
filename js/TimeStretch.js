// TimeStretch.js — pitch-preserving time stretch via WSOLA
// (Waveform Similarity Overlap-Add). Pure ES module, no dependencies.
//
// Frames of ~80 ms are overlap-added at a 50% synthesis hop while the
// corresponding analysis positions advance at hop/ratio. Each frame's input
// position is refined within ±15 ms by maximizing normalized cross-correlation
// against the natural continuation of the previous frame, which avoids the
// phasiness of plain OLA.

// Stretch an AudioBuffer to ratio × its original duration without changing pitch.
// ratio > 1 = slower/longer, ratio < 1 = faster/shorter.
// Returns the input buffer unchanged when ratio ≈ 1 or the buffer is too short.
export function stretchBuffer(ctx, buffer, ratio) {
  if (!isFinite(ratio) || ratio <= 0)   return buffer;
  if (Math.abs(ratio - 1) < 1e-3)       return buffer;

  const sr     = buffer.sampleRate;
  const nCh    = buffer.numberOfChannels;
  const inLen  = buffer.length;
  const outLen = Math.max(1, Math.round(inLen * ratio));

  let frame = Math.min(Math.round(sr * 0.08), Math.floor(inLen / 2));
  if (frame < 32) return buffer;
  frame -= frame % 2;
  const Hs  = frame / 2;                              // synthesis hop (50% overlap)
  const tol = Math.min(Math.round(sr * 0.015), Hs);   // ± similarity search range

  const chData = [];
  for (let ch = 0; ch < nCh; ch++) chData.push(buffer.getChannelData(ch));

  // Mono mix guides the similarity search; all channels then share the same
  // frame positions, preserving the stereo image.
  let mono;
  if (nCh === 1) {
    mono = chData[0];
  } else {
    mono = new Float32Array(inLen);
    for (let ch = 0; ch < nCh; ch++) {
      const d = chData[ch];
      for (let i = 0; i < inLen; i++) mono[i] += d[i];
    }
  }

  // Hann window, plus flat-edged variants so the loop head and tail keep full
  // amplitude instead of fading in/out.
  const hann    = new Float32Array(frame);
  const headWin = new Float32Array(frame);
  const tailWin = new Float32Array(frame);
  for (let i = 0; i < frame; i++) {
    hann[i]    = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
    headWin[i] = i < Hs ? 1 : hann[i];
    tailWin[i] = i < Hs ? hann[i] : 1;
  }

  const padLen = outLen + frame;
  const out    = [];
  for (let ch = 0; ch < nCh; ch++) out.push(new Float32Array(padLen));
  const wsum = new Float32Array(padLen);

  const maxPos = inLen - frame;
  const cmp    = Hs;   // compare length for similarity
  const STRIDE = 4;    // compare subsampling

  // Best offset in [lo, hi] (stepping by `step`) matching the reference segment.
  const search = (ref, lo, hi, step) => {
    let best = lo, bestScore = -Infinity;
    for (let p = lo; p <= hi; p += step) {
      let dot = 0, energy = 0;
      for (let i = 0; i < cmp; i += STRIDE) {
        const a = mono[ref + i];
        const b = mono[p + i];
        dot    += a * b;
        energy += b * b;
      }
      const score = dot / (Math.sqrt(energy) + 1e-9);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  };

  let prevIn = 0;
  for (let k = 0; ; k++) {
    const outPos = k * Hs;
    if (outPos >= outLen) break;
    const isLast = outPos + Hs >= outLen;

    const ideal = Math.min(maxPos, Math.max(0, Math.round(outPos / ratio)));
    let inPos = ideal;
    if (k > 0 && tol > 0) {
      const natural = Math.min(maxPos, prevIn + Hs);
      const lo = Math.max(0, ideal - tol);
      const hi = Math.min(maxPos, ideal + tol);
      if (hi > lo) {
        const coarse = search(natural, lo, hi, 4);   // coarse pass...
        inPos = search(natural, Math.max(lo, coarse - 3), Math.min(hi, coarse + 3), 1); // ...then refine
      }
    }

    const win = k === 0 ? headWin : (isLast ? tailWin : hann);
    for (let ch = 0; ch < nCh; ch++) {
      const src = chData[ch];
      const dst = out[ch];
      for (let i = 0; i < frame; i++) dst[outPos + i] += src[inPos + i] * win[i];
    }
    for (let i = 0; i < frame; i++) wsum[outPos + i] += win[i];

    prevIn = inPos;
    if (isLast) break;
  }

  // Normalize by the accumulated window sum; cap edge gain to avoid boosting
  // residual noise where coverage is thin.
  const result = ctx.createBuffer(nCh, outLen, sr);
  for (let ch = 0; ch < nCh; ch++) {
    const dst = result.getChannelData(ch);
    const acc = out[ch];
    for (let i = 0; i < outLen; i++) {
      const w = wsum[i];
      dst[i] = w > 0.25 ? acc[i] / w : acc[i] * 4;
    }
  }
  return result;
}
