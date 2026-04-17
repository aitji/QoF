from PIL import Image
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
import json
import os
import time
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FOLDER_NAME = 'input'
INPUT_DIR = os.path.join(BASE_DIR, INPUT_FOLDER_NAME)
OUTPUT_DIR = BASE_DIR

RULES_FILE = os.path.join(BASE_DIR, "crop_rules.json")
DEFAULT_CROP = (689, 226, 1240, 493)

_rules_cache: list[tuple[str, tuple[int, int, int, int]]] = []
_rules_mtime: float = 0.0


def refresh_by_keywords(keywords: list[str]) -> None:
    for root, _, files in os.walk(INPUT_DIR):
        for fname in files:
            src = os.path.join(root, fname)
            rel = os.path.relpath(src, INPUT_DIR).lower()

            if any(kw.lower() in rel for kw in keywords):
                try:
                    crop_and_save(src, output_path(src))
                    print(f"[REFRESH] {src}")
                except Exception as e:
                    print(f"[ERROR]   {e}")


def load_rules() -> None:
    global _rules_cache, _rules_mtime
    try:
        mtime = os.path.getmtime(RULES_FILE)
        if mtime == _rules_mtime:
            return

        old_rules = dict(_rules_cache)

        with open(RULES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        _rules_cache = [(entry["keyword"], tuple(entry["crop"]))
                        for entry in data]
        _rules_mtime = mtime

        print(f"[RULES]   loaded {len(_rules_cache)} rule(s)")

        changed_keywords = []
        for kw, box in _rules_cache:
            if kw not in old_rules or old_rules.get(kw) != box:
                changed_keywords.append(kw)

        if changed_keywords:
            print(f"[UPDATE]  changed: {changed_keywords}")
            refresh_by_keywords(changed_keywords)

    except Exception as e:
        print(f"[RULES]   failed: {e}")


SUPPORTED = {".png", ".jpg", ".jpeg"}
KEEP_FILES = {".py", ".cmd", ".json"}
KEEP_DIRS = {INPUT_FOLDER_NAME}


def _to_str(path):
    if isinstance(path, str):
        return path
    return bytes(path).decode()


def get_crop_box(src: str) -> tuple[int, int, int, int]:
    rel = os.path.relpath(src, INPUT_DIR).replace("\\", "/").lower()
    for keyword, box in _rules_cache:
        if keyword.lower() in rel:
            l, t, r, b = box
            if r <= l or b <= t:
                print(f"[WARN]    invalid crop {box} for '{keyword}'")
                return DEFAULT_CROP
            return box
    return DEFAULT_CROP


def output_path(src: str) -> str:
    rel = os.path.relpath(src, INPUT_DIR)
    filename = os.path.splitext(rel)[0] + ".png"
    return os.path.join(OUTPUT_DIR, filename)


def crop_and_save(src: str, dst: str) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    box = get_crop_box(src)

    with Image.open(src) as img:
        w, h = img.size
        l, t, r, b = box

        l = max(1, min(l, w))
        r = max(1, min(r, w))
        t = max(1, min(t, h))
        b = max(1, min(b, h))

        if r <= l or b <= t:
            print(f"[SKIP]    empty crop after clamp {box} -> {(l, t, r, b)}")
            return

        cropped = img.crop((l, t, r, b))

        if os.path.exists(dst):
            os.remove(dst)

        cropped.save(dst, "PNG", optimize=True)

    print(f"[SAVED]   {dst}  (crop {(l, t, r, b)})")


class ImageHandler(FileSystemEventHandler):
    def _is_image(self, path: str) -> bool:
        return os.path.splitext(path)[1].lower() in SUPPORTED

    def on_created(self, event):
        path = _to_str(event.src_path)
        if not event.is_directory and self._is_image(path):
            print(f"[ADDED]   {path}")
            time.sleep(0.1)
            try:
                crop_and_save(path, output_path(path))
            except Exception as e:
                print(f"[ERROR]   {e}")

    def on_modified(self, event):
        path = _to_str(event.src_path)
        if not event.is_directory and self._is_image(path):
            print(f"[CHANGED] {path}")
            time.sleep(0.1)
            try:
                crop_and_save(path, output_path(path))
            except Exception as e:
                print(f"[ERROR]   {e}")

    def on_deleted(self, event):
        path = _to_str(event.src_path)
        if not event.is_directory and self._is_image(path):
            dst = output_path(path)
            if os.path.exists(dst):
                os.remove(dst)
                print(f"[REMOVED] {dst}")

    def on_moved(self, event):
        if not event.is_directory:
            src = _to_str(event.src_path)
            dst_path = _to_str(event.dest_path)

            old_dst = output_path(src)
            if self._is_image(src) and os.path.exists(old_dst):
                os.remove(old_dst)
                print(f"[REMOVED] {old_dst}")

            if self._is_image(dst_path):
                print(f"[RENAMED] {dst_path}")
                time.sleep(0.1)
                try:
                    crop_and_save(dst_path, output_path(dst_path))
                except Exception as e:
                    print(f"[ERROR]   {e}")


def sync_existing() -> None:
    for root, _, files in os.walk(INPUT_DIR):
        for fname in files:
            src = os.path.join(root, fname)
            if os.path.splitext(fname)[1].lower() in SUPPORTED:
                dst = output_path(src)
                try:
                    crop_and_save(src, dst)
                except Exception as e:
                    print(f"[ERROR]   {e}")


def safe_clear_root():
    for name in os.listdir(OUTPUT_DIR):
        path = os.path.join(OUTPUT_DIR, name)

        if os.path.isdir(path):
            if name in KEEP_DIRS:
                continue
            shutil.rmtree(path)
            print(f"[DEL DIR] {path}")
            continue

        ext = os.path.splitext(name)[1].lower()
        if ext in KEEP_FILES:
            continue

        os.remove(path)
        print(f"[DEL FILE] {path}")


if __name__ == "__main__":
    os.makedirs(INPUT_DIR, exist_ok=True)
    load_rules()

    print(f"--------- [Watching '{INPUT_DIR}\\' -> root]")
    sync_existing()

    observer = Observer()
    observer.schedule(ImageHandler(), path=INPUT_DIR, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(2)
            load_rules()
    except KeyboardInterrupt:
        observer.stop()
        print("\nStopped")

    observer.join()
