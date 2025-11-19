import time

import kagglehub
from requests.exceptions import ReadTimeout, ConnectionError

# Try to bump KaggleHub internal timeouts if the API allows it
try:
    import kagglehub.clients as kh_clients

    # Increase default timeouts (seconds)
    kh_clients.DEFAULT_CONNECT_TIMEOUT = 30
    kh_clients.DEFAULT_READ_TIMEOUT = 120
    print("[kitsune] Patched KaggleHub timeouts: connect=30s, read=120s")
except Exception as e:
    print("[kitsune] Could not patch KaggleHub timeouts:", e)

DATASET = "ymirsky/network-attack-dataset-kitsune"


def download_with_retries(max_retries=5, delay=10):
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[kitsune] Attempt {attempt}/{max_retries} - downloading dataset ...")
            path = kagglehub.dataset_download(DATASET)
            print("[kitsune] Download OK.")
            return path
        except ReadTimeout as e:
            print(f"[kitsune] ReadTimeout on attempt {attempt}: {e}")
        except ConnectionError as e:
            print(f"[kitsune] ConnectionError on attempt {attempt}: {e}")
        except Exception as e:
            print(f"[kitsune] Other error on attempt {attempt}: {e}")

        if attempt < max_retries:
            print(f"[kitsune] Waiting {delay} seconds before retrying ...")
            time.sleep(delay)

    raise RuntimeError(f"Failed to download dataset {DATASET} after {max_retries} attempts")


if __name__ == "__main__":
    print("[kitsune] Downloading / locating dataset:", DATASET)
    root = download_with_retries()
    print("[kitsune] Dataset root:", root)
