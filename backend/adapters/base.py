"""
Base CSV adapter.

Today: loads a CSV file from DATA_DIR into a cached pandas DataFrame.
Later: replace _load() with a call to the real upstream API/database.
       Keep the public interface (rows, clear_cache) unchanged.
"""

from __future__ import annotations

import math
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BOOL_TRUE = {"true", "1", "yes", "t"}
_BOOL_FALSE = {"false", "0", "no", "f"}


def _coerce_value(val: Any) -> Any:
    """Convert a raw cell value coming out of pandas to a JSON-safe Python type.

    Rules
    -----
    * NaN / None → None
    * pandas NA → None
    * bool-like strings → bool
    * everything else → as-is (str, int, float)
    """
    # Catch all float NaN / pandas NA / None
    try:
        if val is None:
            return None
        if isinstance(val, float) and math.isnan(val):
            return None
        # pandas NA (pd.NA) - truthy check raises TypeError
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass  # pd.isna raised on unhashable – value is not NA

    # Bool coercion for string values that come straight from CSV
    if isinstance(val, str):
        low = val.strip().lower()
        if low in _BOOL_TRUE:
            return True
        if low in _BOOL_FALSE:
            return False

    return val


# ---------------------------------------------------------------------------
# CsvAdapter
# ---------------------------------------------------------------------------


class CsvAdapter:
    """Base adapter that reads one CSV file into memory (cached per instance).

    Subclasses declare ``filename`` (e.g. ``"cases.csv"``).

    Environment variable
    --------------------
    DATA_DIR : str
        Directory that contains the CSV files.
        Defaults to ``"data/ongoing"`` relative to the repository root.
    """

    #: Override in subclass — just the basename, e.g. "cases.csv"
    filename: str = ""

    def __init__(self) -> None:
        if not self.filename:
            raise NotImplementedError(
                f"{self.__class__.__name__} must set `filename`."
            )
        self._df: pd.DataFrame | None = None

    # ------------------------------------------------------------------
    # Internal loading
    # ------------------------------------------------------------------

    def _data_path(self) -> Path:
        data_dir = os.environ.get("DATA_DIR", "data/ongoing")
        return Path(data_dir) / self.filename

    def _load(self) -> pd.DataFrame:
        """Load CSV, caching the result on the instance."""
        if self._df is None:
            path = self._data_path()
            if not path.exists():
                raise FileNotFoundError(
                    f"[{self.__class__.__name__}] CSV not found: '{path}'. "
                    f"Set the DATA_DIR environment variable to the folder "
                    f"that contains '{self.filename}'."
                )
            self._df = pd.read_csv(path, dtype=str)  # read everything as str; we coerce explicitly
        return self._df

    def clear_cache(self) -> None:
        """Drop the cached DataFrame so the next call reloads from disk."""
        self._df = None

    # ------------------------------------------------------------------
    # Public query interface
    # ------------------------------------------------------------------

    def rows(self, filter: dict | None = None) -> list[dict]:
        """Return all rows as a list of dicts, optionally filtered.

        Parameters
        ----------
        filter:
            A mapping of ``{column: value}`` where *all* conditions must
            match (logical AND).  ``None`` or ``{}`` returns all rows.

        Returns
        -------
        list[dict]
            Each dict has the same keys as the CSV header.  NaN values
            are replaced with ``None``; ``"True"``/``"False"`` strings
            are converted to Python bools.

        Notes
        -----
        Owner / personal names are never included in the return value by
        design — the underlying CSVs do not contain them.
        """
        df = self._load()

        if filter:
            mask = pd.Series([True] * len(df), index=df.index)
            for col, val in filter.items():
                if col not in df.columns:
                    # Unknown column → return empty instead of crashing
                    return []
                mask &= df[col] == str(val)
            df = df[mask]

        return [
            {col: _coerce_value(row[col]) for col in df.columns}
            for row in df.to_dict(orient="records")
        ]
