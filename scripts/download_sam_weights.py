"""
Download Pretrained Weights for Segment Anything Model (SAM)
Smart India Hackathon 2026 — Cadastral AI Mapper

Downloads Meta's SAM checkpoint (ViT-B, ViT-L, or ViT-H) and places it into ml_pipeline/checkpoints/.
"""

import sys
import argparse
import requests
from pathlib import Path
from ml_pipeline.config import CHECKPOINTS_DIR, SAM_CHECKPOINT_URLS, SAM_CHECKPOINT_TYPE


def download_sam_weights(model_type: str = SAM_CHECKPOINT_TYPE, force: bool = False) -> Path:
    """
    Downloads the specified SAM checkpoint with progress reporting.
    """
    if model_type not in SAM_CHECKPOINT_URLS:
        print(f"[Error] Invalid model type '{model_type}'. Choose from: {list(SAM_CHECKPOINT_URLS.keys())}")
        sys.exit(1)

    url = SAM_CHECKPOINT_URLS[model_type]
    filename = f"sam_{model_type}.pth"
    dest_path = CHECKPOINTS_DIR / filename

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

    if dest_path.exists() and not force:
        size_mb = dest_path.stat().st_size / (1024 * 1024)
        print(f"[Info] Checkpoint already exists: {dest_path} ({size_mb:.2f} MB)")
        print("Use --force to redownload.")
        return dest_path

    print(f"===========================================================")
    print(f"  Downloading SAM Checkpoint: {model_type.upper()}")
    print(f"  Source URL: {url}")
    print(f"  Destination: {dest_path}")
    print(f"===========================================================\n")

    try:
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()

        total_size = int(response.headers.get("content-length", 0))
        total_mb = total_size / (1024 * 1024) if total_size else 0

        downloaded = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        with open(dest_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size:
                        percent = (downloaded / total_size) * 100
                        mb_done = downloaded / (1024 * 1024)
                        sys.stdout.write(f"\r  Progress: [{mb_done:.1f}/{total_mb:.1f} MB] ({percent:.1f}%)")
                        sys.stdout.flush()

        print(f"\n\n[Success] SAM checkpoint downloaded successfully to: {dest_path}")
        return dest_path

    except Exception as e:
        print(f"\n[Error] Download failed: {e}")
        if dest_path.exists():
            dest_path.unlink()  # Clean up incomplete file
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download Segment Anything Model (SAM) pretrained weights.")
    parser.add_argument(
        "--model",
        type=str,
        default="vit_b",
        choices=["vit_b", "vit_l", "vit_h"],
        help="SAM backbone model architecture (default: vit_b ~375MB)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force redownload even if checkpoint already exists"
    )

    args = parser.parse_args()
    download_sam_weights(model_type=args.model, force=args.force)
