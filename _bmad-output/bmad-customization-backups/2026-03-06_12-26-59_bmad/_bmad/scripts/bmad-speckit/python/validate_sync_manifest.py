#!/usr/bin/env python3
"""
双 repo 同步清单校验脚本（与 双repo_bmad_speckit_智能同步方案.md §7.1 一致）。
读取 sync-manifest，对每条路径在两边计算 SHA256 checksum，输出一致/不一致列表。
用法: python validate_sync_manifest.py --manifest sync-manifest.yaml --repo-a /path/to/repoA --repo-b /path/to/repoB
从项目根执行时: python _bmad/scripts/bmad-speckit/python/validate_sync_manifest.py --manifest sync-manifest.yaml --repo-a . --repo-b D:/path/to/BMAD-Speckit-SDD-Flow
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path


def load_manifest_yaml(path: Path) -> list[dict]:
    """加载 YAML 清单；若无 PyYAML 则尝试解析简单格式。"""
    text = path.read_text(encoding="utf-8")
    try:
        import yaml

        data = yaml.safe_load(text)
    except ImportError:
        data = _parse_simple_yaml(text)
    if not data or "paths" not in data:
        return []
    return data["paths"] if isinstance(data["paths"], list) else []


def _parse_simple_yaml(text: str) -> dict:
    """最小 YAML 解析：仅支持 paths: 与 - path_a: "x" path_b: "y" 多行。"""
    paths: list[dict] = []
    current: dict | None = None
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "paths:":
            continue
        if stripped.startswith("- "):
            if current and current.get("path_a") and current.get("path_b"):
                paths.append(current)
            current = {"path_a": "", "path_b": ""}
            rest = stripped[2:].strip()
            if "path_a:" in rest:
                current["path_a"] = rest.split("path_a:")[-1].split("path_b:")[0].strip().strip('"\'')
            if "path_b:" in rest:
                current["path_b"] = rest.split("path_b:")[-1].strip().strip('"\'')
            continue
        if current is not None:
            if "path_a:" in line:
                current["path_a"] = line.split("path_a:")[-1].strip().strip('"\'').rstrip()
            elif "path_b:" in line:
                current["path_b"] = line.split("path_b:")[-1].strip().strip('"\'').rstrip()
    if current and (current.get("path_a") or current.get("path_b")):
        paths.append(current)
    return {"paths": paths} if paths else {}


def load_manifest(path: Path) -> list[tuple[str, str]]:
    """返回 [(path_a, path_b), ...]。"""
    raw = load_manifest_yaml(path)
    out: list[tuple[str, str]] = []
    for item in raw:
        if isinstance(item, dict) and "path_a" in item and "path_b" in item:
            out.append((str(item["path_a"]).strip(), str(item["path_b"]).strip()))
    return out


def file_sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files(root: Path, prefix: Path) -> list[Path]:
    """root 下相对 prefix 的所有文件（递归）。"""
    if not root.is_dir():
        return []
    out: list[Path] = []
    try:
        for f in root.rglob("*"):
            if f.is_file():
                try:
                    out.append(f.relative_to(prefix))
                except ValueError:
                    out.append(f)
    except OSError:
        pass
    return sorted(out, key=lambda x: str(x))


def compare_entry(
    repo_a: Path,
    repo_b: Path,
    path_a: str,
    path_b: str,
) -> list[tuple[str, str, str]]:
    """返回 [(rel_path, status, detail), ...]，status 为 OK|MISMATCH|MISSING_A|MISSING_B。"""
    results: list[tuple[str, str, str]] = []
    full_a = (repo_a / path_a).resolve()
    full_b = (repo_b / path_b).resolve()

    if full_a.is_file() and full_b.is_file():
        ha = file_sha256(full_a)
        hb = file_sha256(full_b)
        if ha == hb:
            results.append((path_a, "OK", "checksum match"))
        else:
            results.append((path_a, "MISMATCH", f"checksum A={ha[:16]}... B={hb[:16]}..."))
        return results
    if full_a.is_file() and not full_b.exists():
        results.append((path_a, "MISSING_B", str(full_b)))
        return results
    if full_b.is_file() and not full_a.exists():
        results.append((path_b, "MISSING_A", str(full_a)))
        return results
    if not full_a.exists() and not full_b.exists():
        results.append((path_a, "MISSING_BOTH", f"A={full_a} B={full_b}"))
        return results
    if full_a.is_file() or full_b.is_file():
        results.append((path_a, "MISMATCH", "one is file, other is dir or missing"))
        return results

    # 两边均为目录：按相对路径对齐比较
    prefix_a = full_a
    prefix_b = full_b

    files_a = set(p for p in collect_files(prefix_a, prefix_a))
    files_b = set(p for p in collect_files(prefix_b, prefix_b))
    all_rel = sorted(files_a | files_b, key=str)
    for rel in all_rel:
        fa = prefix_a / rel
        fb = prefix_b / rel
        rel_str = str(rel).replace("\\", "/")
        if fa.is_file() and fb.is_file():
            ha = file_sha256(fa)
            hb = file_sha256(fb)
            if ha == hb:
                results.append((rel_str, "OK", "match"))
            else:
                results.append((rel_str, "MISMATCH", f"A={ha[:12]}... B={hb[:12]}..."))
        elif fa.is_file():
            results.append((rel_str, "MISSING_B", str(fb)))
        elif fb.is_file():
            results.append((rel_str, "MISSING_A", str(fa)))
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate sync-manifest between two repo roots (checksum).")
    ap.add_argument("--manifest", "-m", required=True, help="Path to sync-manifest.yaml")
    ap.add_argument("--repo-a", "-a", required=True, help="Repo A root (e.g. micang-trader)")
    ap.add_argument("--repo-b", "-b", required=True, help="Repo B root (e.g. BMAD-Speckit-SDD-Flow)")
    ap.add_argument("--quiet", "-q", action="store_true", help="Only print summary and failures")
    args = ap.parse_args()

    manifest_path = Path(args.manifest).resolve()
    repo_a = Path(args.repo_a).resolve()
    repo_b = Path(args.repo_b).resolve()

    if not manifest_path.is_file():
        print(f"Error: manifest not found: {manifest_path}", file=sys.stderr)
        return 2
    if not repo_a.is_dir():
        print(f"Error: repo-a not a directory: {repo_a}", file=sys.stderr)
        return 2
    if not repo_b.is_dir():
        print(f"Error: repo-b not a directory: {repo_b}", file=sys.stderr)
        return 2

    pairs = load_manifest(manifest_path)
    if not pairs:
        print("Warning: no paths in manifest (or YAML format not recognized).", file=sys.stderr)
        print("Expected format: paths: - path_a: \"_bmad/\" path_b: \"_bmad/\"", file=sys.stderr)
        return 2

    all_results: list[tuple[str, str, str]] = []
    for path_a, path_b in pairs:
        all_results.extend(compare_entry(repo_a, repo_b, path_a, path_b))

    ok = sum(1 for _, s, _ in all_results if s == "OK")
    mismatch = sum(1 for _, s, _ in all_results if s == "MISMATCH")
    missing = sum(1 for _, s, _ in all_results if s.startswith("MISSING"))

    if not args.quiet:
        for rel, status, detail in all_results:
            if status == "OK":
                print(f"  OK   {rel}")
            else:
                print(f"  {status:12} {rel}  ({detail})")

    print()
    print(f"Summary: OK={ok}  MISMATCH={mismatch}  MISSING={missing}  total={len(all_results)}")
    if mismatch or missing:
        print("Result: 清单内项存在不一致，请检查上述输出。")
        return 1
    print("Result: 清单内项一致。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
