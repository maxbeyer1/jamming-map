import os
import json
import argparse
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import earthaccess


def load_manifest(manifest_path):
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r') as f:
            return json.load(f)
    return {"files": [], "last_updated": None}


def save_manifest(manifest, manifest_path):
    manifest["last_updated"] = datetime.utcnow().isoformat() + "Z"
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)


def cleanup_old_files(cache_dir, manifest, max_age_hours=72):
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    files_to_keep = []

    for file_info in manifest["files"]:
        file_time = datetime.fromisoformat(
            file_info["download_time"].replace('Z', '+00:00'))
        file_path = os.path.join(cache_dir, file_info["filename"])

        if file_time > cutoff_time:
            files_to_keep.append(file_info)
        else:
            # Remove old file
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"Removed old file: {file_info['filename']}")

    manifest["files"] = files_to_keep
    return len(manifest["files"]) - len(files_to_keep)


def get_filename_from_granule(granule):
    # Try to get the filename from the granule metadata
    if hasattr(granule, 'data_links') and granule.data_links:
        if len(granule.data_links()) > 0:
            url = granule.data_links()[0]
        else:
            return None

        return os.path.basename(url)
    else:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache-dir", default="./cache/raw_files")
    parser.add_argument("--manifest", default="./cache/manifest.json")
    parser.add_argument("--hours", type=int, default=24)
    parser.add_argument("--cleanup", action="store_true")

    args = parser.parse_args()

    # Create cache directory if it doesn't exist
    os.makedirs(args.cache_dir, exist_ok=True)
    os.makedirs(os.path.dirname(args.manifest), exist_ok=True)

    # Load existing manifest
    manifest = load_manifest(args.manifest)
    existing_files = {f["filename"] for f in manifest["files"]}

    print(f"Loaded cache with {len(existing_files)} existing files")

    if args.cleanup:
        removed_count = cleanup_old_files(
            args.cache_dir, manifest, max_age_hours=24)
        if removed_count > 0:
            print(f"Cleaned up {removed_count} old files")

    try:
        print("Authenticating with earthaccess...")

        # Load creds from environment variables
        load_dotenv()
        if not os.getenv("EARTHDATA_USERNAME") or not os.getenv("EARTHDATA_PASSWORD"):
            print("Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD")
            return 1

        auth = earthaccess.login(strategy='environment')

        # last N hours
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(hours=args.hours)

        date_range = (
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )

        print(
            f"Searching for SMAP data from {date_range[0]} to {date_range[1]}")

        results = earthaccess.search_data(
            short_name='SPL1BTB_NRT',
            temporal=date_range
        )

        print(f"Found {len(results)} granules")

        # Filter out already downloaded files
        new_granules = []
        for granule in results:
            filename = get_filename_from_granule(granule)
            if filename and filename not in existing_files:
                new_granules.append(granule)

        print(f"Found {len(new_granules)} new files to download")

        if new_granules:
            print("Downloading new files...")
            downloaded_files = earthaccess.download(
                new_granules,
                local_path=args.cache_dir
            )

            # Update manifest with new files
            current_time = datetime.utcnow().isoformat() + "Z"

            for i, downloaded_path in enumerate(downloaded_files):
                if downloaded_path:  # earthaccess returns None for failed downloads
                    filename = os.path.basename(downloaded_path)
                    file_info = {
                        "filename": filename,
                        "download_time": current_time,
                        "file_path": downloaded_path
                    }
                    manifest["files"].append(file_info)
                    print(f"Downloaded: {filename}")

            save_manifest(manifest, args.manifest)
            print(f"Updated manifest with {len(downloaded_files)} new files")

            # Output summary for Node.js
            summary = {
                "status": "success",
                "new_files": len([f for f in downloaded_files if f]),
                "total_files": len(manifest["files"]),
                "download_time": current_time
            }
            print("DOWNLOAD_SUMMARY:", json.dumps(summary))

        else:
            print("No new files to download")
            summary = {
                "status": "success",
                "new_files": 0,
                "total_files": len(manifest["files"]),
                "download_time": datetime.utcnow().isoformat() + "Z"
            }
            print("DOWNLOAD_SUMMARY:", json.dumps(summary))

    except Exception as e:
        print(f"Error fetching SMAP data: {e}")
        error_summary = {
            "status": "error",
            "error": str(e),
            "new_files": 0
        }
        print("DOWNLOAD_SUMMARY:", json.dumps(error_summary))
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
