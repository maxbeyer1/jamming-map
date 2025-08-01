import os
import argparse
import json
import numpy as np
import h5py


def extract_extreme_tb(h5_file, threshold=310):
    points = []
    try:
        with h5py.File(h5_file, 'r') as f:
            # Extract data
            bt = f['Brightness_Temperature']
            tb_h = bt['tb_h'][:]
            tb_v = bt['tb_v'][:]
            lat = bt['tb_lat'][:]
            lon = bt['tb_lon'][:]

            avg_tb = (tb_h + tb_v) / 2

            # Mask for temperatures above threshold and w/ valid coords
            mask = (avg_tb > threshold) & np.isfinite(
                avg_tb) & np.isfinite(lat) & np.isfinite(lon)

            lat_flat = lat[mask].flatten()
            lon_flat = lon[mask].flatten()
            tb_flat = avg_tb[mask].flatten()

            for la, lo, tb in zip(lat_flat, lon_flat, tb_flat):
                pt = [float(la), float(lo), float(tb)]
                points.append(pt)

    except Exception as e:
        print(f"Error processing {h5_file}: {e}")
    return points


def process_files(paths, threshold=310):
    all_points = []
    for path in paths:
        if path.lower().endswith(".h5"):  # Process HDF5 files (data format NASA SMAP uses)
            pts = extract_extreme_tb(path, threshold)
            all_points.extend(pts)
    return all_points


def main():
    parser = argparse.ArgumentParser(
        description="Generate JSON data for heatmaps of extreme SMAP brightness temperatures.")
    parser.add_argument(
        "input", help="Path to a single HDF5 file or directory of files.")
    parser.add_argument("--threshold", type=float, default=310,
                        help="TB threshold in Kelvin (default: 310)")

    args = parser.parse_args()

    # Resolve file list
    if os.path.isfile(args.input):
        files = [args.input]
    elif os.path.isdir(args.input):
        files = [os.path.join(args.input, f) for f in os.listdir(
            args.input) if f.lower().endswith(".h5")]
    else:
        print("Invalid input path.")
        return

    points = process_files(files, args.threshold)

    # Output JSON data for Node
    if points:
        temps = [p[2] for p in points]
        output_data = {
            "points": points,
            "stats": {
                "total_points": len(points),
                "max_tb": float(max(temps)),
                "min_tb": float(min(temps)),
                "avg_tb": float(sum(temps) / len(temps)),
                "threshold_used": args.threshold
            }
        }
        print(json.dumps(output_data))
    else:
        # Output empty data structure
        output_data = {
            "points": [],
            "stats": {
                "total_points": 0,
                "max_tb": 0,
                "min_tb": 0,
                "avg_tb": 0,
                "threshold_used": args.threshold
            }
        }
        print(json.dumps(output_data))


if __name__ == "__main__":
    main()
