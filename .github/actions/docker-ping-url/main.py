import os
import requests
import time

def set_output(file_path, key, value):
    with open(file_path, "a") as file:
        print(f"{key}={value}", file=file)

def ping_url(target_url, delay, max_attempts): 
    attempts = 0
    # needs input validation
    while attempts < max_attempts:
        try:
            response = requests.get(target_url)
            if response.status_code == 200:
                print(f"The website {target_url} is available.")
                return True
        except requests.ConnectionError:
            print(f"Website {target_url} is unreachable. Retrying in {delay} seconds...")
            time.sleep(delay)
            attempts += 1
        except requests.exceptions.MissingSchema:
            print(f"Invalid URL format: {target_url}. Make sure it starts with http:// or https://")
            return False
    return False

    
def run():
    target_url = os.getenv("INPUT_TARGET_URL")
    delay = int(os.getenv("INPUT_DELAY"))
    max_attempts = int(os.getenv("INPUT_MAX_ATTEMPTS"))

    website_reachable = ping_url(target_url, delay, max_attempts)

    set_output(os.getenv("GITHUB_OUTPUT"), "url-reachable", website_reachable)
    if not website_reachable:
        raise Exception(f"Website {target_url} is malformed or unreachable.")
    
    print(f"Website {target_url} is reachable.")


if __name__ == "__main__":
    run()