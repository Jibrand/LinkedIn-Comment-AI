// Using built-in fetch in Node 18+
const API_BASE = "http://localhost:3001/api/v1";

const testEmail = `testuser_${Date.now()}@example.com`;
const testPassword = "securepassword123";
let authToken = "";

async function runTests() {
    console.log("🚀 Starting API Tests...\n");

    try {
        // 1. Test Registration
        console.log(`[1] Testing Registration: POST /auth/register`);
        const regRes = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Test User",
                email: testEmail,
                password: testPassword
            })
        });
        const regData = await regRes.json();
        console.log("Response:", regData);
        if (!regData.success) throw new Error("Registration failed");
        authToken = regData.token;
        console.log("✅ Registration passed\n");

        // 2. Test Login
        console.log(`[2] Testing Login: POST /auth/login`);
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        const loginData = await loginRes.json();
        console.log("Response:", { success: loginData.success, message: loginData.message, hasToken: !!loginData.token });
        if (!loginData.success) throw new Error("Login failed");
        authToken = loginData.token; // Keep fresh token
        console.log("✅ Login passed\n");

        // 3. Test Get User Info (/auth/me)
        console.log(`[3] Testing Get User Info: GET /auth/me`);
        const meRes = await fetch(`${API_BASE}/auth/me`, {
            method: "GET",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            }
        });
        const meData = await meRes.json();
        console.log("Response:", meData);
        if (!meData.success || !meData.result.email) throw new Error("Get user info failed");
        if (meData.result.password) throw new Error("Security check failed: Password returned in user info!");
        console.log("✅ Get User Info passed\n");

        // 4. Test Create Comment Record
        console.log(`[4] Testing Create Comment Record: POST /comment`);
        const addCommentRes = await fetch(`${API_BASE}/comment`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            }
        });
        const addCommentData = await addCommentRes.json();
        console.log("Response:", addCommentData);
        if (!addCommentData.success) throw new Error("Create comment failed");
        console.log("✅ Create Comment Record passed\n");

        // 5. Test Get Comment Stats
        console.log(`[5] Testing Get Comment Stats: GET /comment/stats`);
        const statsRes = await fetch(`${API_BASE}/comment/stats`, {
            method: "GET",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            }
        });
        const statsData = await statsRes.json();
        console.log("Response:", statsData);
        if (!statsData.success || statsData.totalComments < 1) throw new Error("Get comment stats failed");
        console.log("✅ Get Comment Stats passed\n");

        console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");

    } catch (error) {
        console.error("❌ TEST FAILED:", error.message || error);
    }
}

runTests();
