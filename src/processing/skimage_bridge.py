"""Bridge script for scikit-image skeletonization methods.

Called from TypeScript via `uv run --with scikit-image`.
Reads JSON from stdin: {width, height, method, bitmap (base64), maxIter?}
Writes JSON to stdout: {skeleton (base64)}
"""

import base64
import json
import sys

import numpy as np
from skimage.morphology import medial_axis, skeletonize, thin

data = json.loads(sys.stdin.read())
width = data["width"]
height = data["height"]
method = data["method"]
raw = base64.b64decode(data["bitmap"])
image = np.frombuffer(raw, dtype=np.uint8).reshape(height, width) > 0

if method == "lee":
    result = skeletonize(image, method="lee")
elif method == "zhang":
    result = skeletonize(image, method="zhang")
elif method == "thin":
    max_iter = data.get("maxIter")
    result = thin(image, max_num_iter=max_iter)
elif method == "medial-axis":
    result = medial_axis(image)
else:
    result = skeletonize(image)

output = result.astype(np.uint8)
print(json.dumps({"skeleton": base64.b64encode(output.tobytes()).decode()}))
