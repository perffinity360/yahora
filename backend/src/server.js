// backend\src\server.js
import os from 'node:os';
import app from './app.js';
import dotenv from 'dotenv';
import { startCronJobs } from './utils/cronJobs.js';

// Load env variables from the backend root
dotenv.config(); 

const PORT = process.env.PORT || 5000;

// Bind all interfaces explicitly so phones and other laptops on the LAN can
// reach port 5000. Node already defaults to the unspecified address when host
// is omitted, but it prefers :: (IPv6); pinning 0.0.0.0 keeps the listener on
// IPv4, which is what the LAN clients and --dns-result-order=ipv4first assume.
const HOST = process.env.HOST || '0.0.0.0';

/**
 * First non-internal IPv4 address of this machine — the address other devices
 * on the LAN use to reach us. Printed as a convenience only; nothing in the
 * app reads it, so a wrong guess here cannot break a request.
 */
function lanAddress() {
    for (const addresses of Object.values(os.networkInterfaces())) {
        for (const address of addresses ?? []) {
            if (address.family === 'IPv4' && !address.internal) return address.address;
        }
    }
    return null;
}

app.listen(PORT, HOST, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);

    const lan = lanAddress();
    if (lan) console.log(`   LAN: http://${lan}:${PORT}`);

    startCronJobs();
});
