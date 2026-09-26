"""Vocal / instrumental separation with the UVR MDX-Net Kim_Vocal_2 ONNX model (numpy STFT, no torch).

usage: python3 separate.py in.wav out_prefix
writes out_prefix_vocals.wav and out_prefix_instrumental.wav at 44.1 kHz stereo.
"""
import sys, numpy as np, soundfile as sf, onnxruntime as ort, librosa

MODEL = "/home/user/models/Kim_Vocal_2.onnx"
N_FFT, HOP, DIM_F, DIM_T = 7680, 1024, 3072, 256
CHUNK = HOP * (DIM_T - 1)
TRIM = N_FFT // 2
GEN = CHUNK - 2 * TRIM
WIN = np.hanning(N_FFT + 1)[:-1].astype(np.float32)  # periodic hann, like torch.hann_window


def stft(x):  # x: [C, L] -> [C, F, T] complex
    pad = N_FFT // 2
    xp = np.pad(x, ((0, 0), (pad, pad)), mode="reflect")
    T = 1 + (xp.shape[1] - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(T)[:, None]
    fr = xp[:, idx] * WIN  # [C, T, N]
    return np.fft.rfft(fr, axis=-1).transpose(0, 2, 1)  # [C, F, T]


def istft(X, length):  # X: [C, F, T] complex
    fr = np.fft.irfft(X.transpose(0, 2, 1), n=N_FFT, axis=-1) * WIN  # [C, T, N]
    C, T, _ = fr.shape
    L = N_FFT + HOP * (T - 1)
    out = np.zeros((C, L), np.float64); wsum = np.zeros(L, np.float64)
    for t in range(T):
        out[:, t * HOP:t * HOP + N_FFT] += fr[:, t]
        wsum[t * HOP:t * HOP + N_FFT] += WIN ** 2
    out /= np.maximum(wsum, 1e-8)
    pad = N_FFT // 2
    return out[:, pad:pad + length]


def main(inp, prefix):
    y, sr = librosa.load(inp, sr=44100, mono=False)
    if y.ndim == 1: y = np.stack([y, y])
    n = y.shape[1]
    pad = GEN - n % GEN
    mix = np.concatenate([np.zeros((2, TRIM)), y, np.zeros((2, pad)), np.zeros((2, TRIM))], 1).astype(np.float32)
    sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
    outs = []
    i = 0
    while i < n + pad:
        w = mix[:, i:i + CHUNK]
        S = stft(w)[:, :DIM_F, :]  # [2, 3072, 256]
        spec = np.stack([S[0].real, S[0].imag, S[1].real, S[1].imag])[None].astype(np.float32)
        o = sess.run(None, {"input": spec})[0][0]
        Z = np.zeros((2, N_FFT // 2 + 1, DIM_T), np.complex64)
        Z[0, :DIM_F] = o[0] + 1j * o[1]
        Z[1, :DIM_F] = o[2] + 1j * o[3]
        wav = istft(Z, CHUNK)
        outs.append(wav[:, TRIM:-TRIM])
        i += GEN
        print(f"\r{min(i, n)}/{n}", end="", flush=True)
    voc = np.concatenate(outs, 1)[:, :n] * 1.009
    inst = y - voc
    sf.write(prefix + "_vocals.wav", voc.T, 44100)
    sf.write(prefix + "_instrumental.wav", inst.T, 44100)
    print("\ndone")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
