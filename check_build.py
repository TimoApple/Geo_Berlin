import urllib.request, json

# Check Geo_Berlin repo
url = "https://api.github.com/repos/TimoApple/Geo_Berlin/actions/runs?branch=master&per_page=1"
try:
    data = urllib.request.urlopen(url).read()
    d = json.loads(data)
    if d.get("workflow_runs") and len(d["workflow_runs"]) > 0:
        r = d["workflow_runs"][0]
        print("=== Geo_Berlin Build ===")
        print("Run ID:", r["id"])
        print("Status:", r["status"])
        print("Conclusion:", r["conclusion"])
        print("Created:", r["created_at"])
        print("Updated:", r["updated_at"])
        print("URL:", r["html_url"])
    else:
        print("=== Geo_Berlin ===")
        print("No workflow runs found. Build may not have started yet.")
except Exception as e:
    print("Error:", e)
