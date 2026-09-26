"""Character mattes with the IS-Net anime segmentation model (rembg's isnet-anime, run through onnxruntime).

    from matte import Matter
    m = Matter()            # loads the model once
    alpha = m(rgb_uint8)    # float32 HxW in [0, 1]
"""
import numpy as np
import onnxruntime as ort
import cv2

MODELS = {"anime": "/home/user/models/isnet-anime.onnx", "human": "/home/user/models/u2net_human_seg.onnx"}


class Matter:
    def __init__(self, kind="anime", threads=4):
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        self.kind = kind
        self.sess = ort.InferenceSession(MODELS[kind], so, providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0].name
        self.size = 1024 if kind == "anime" else 320

    def __call__(self, rgb):
        h, w = rgb.shape[:2]
        im = cv2.resize(rgb, (self.size, self.size), interpolation=cv2.INTER_AREA).astype(np.float32)
        im /= max(1.0, im.max())
        mean = np.array([0.485, 0.456, 0.406], np.float32)
        std = np.array([1.0, 1.0, 1.0], np.float32) if self.kind == "anime" else np.array([0.229, 0.224, 0.225], np.float32)
        x = ((im - mean) / std).transpose(2, 0, 1)[None].astype(np.float32)
        pred = self.sess.run(None, {self.inp: x})[0][0, 0]
        pred = (pred - pred.min()) / max(1e-6, pred.max() - pred.min())
        return cv2.resize(pred, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32)
