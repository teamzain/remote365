import http.client
import json

def test_post():
    conn = http.client.HTTPConnection("127.0.0.1", 3001)
    payload = json.dumps({
        "accessKey": "000000000",
        "password": "test"
    })
    headers = {
        'Content-Type': 'application/json'
    }
    
    print("Sending POST /api/devices/verify-access to 127.0.0.1:3001...")
    try:
        conn.request("POST", "/api/devices/verify-access", payload, headers)
        res = conn.getresponse()
        data = res.read()
        print(f"Status: {res.status}")
        print(f"Response Body: {data.decode()}")
    except Exception as e:
        print(f"Error connecting: {e}")

if __name__ == "__main__":
    test_post()
