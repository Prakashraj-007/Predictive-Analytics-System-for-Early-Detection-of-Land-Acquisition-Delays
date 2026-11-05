from __future__ import annotations

from pathlib import Path

from data_gen.generate_historical import generate_dataset


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    upload_dir = root / "data" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    df = generate_dataset(300, seed=77)
    df["project_id"] = [f"UPL-{idx:04d}" for idx in range(1, len(df) + 1)]
    out_path = upload_dir / "new.csv"
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")


if __name__ == "__main__":
    main()
