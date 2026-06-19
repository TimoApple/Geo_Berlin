import urllib.request, json

# Check Geo_Berlin repo runs on main
url = "https://api.github.com/repos/TimoApple/Geo_Berlin/actions/runs?branch=main&per_page=5"
data = urllib.request.urlopen(url).read()
d = json.loads(data)
print("Total runs:", d.get("total_count", 0))
for r in d.get("workflow_runs", []):
    msg = r.get("head_commit", {}).get("message", "?")[:60]
    print(f"  #{r['id']} status={r['status']} conclusion={r['conclusion']} msg={msg}")
