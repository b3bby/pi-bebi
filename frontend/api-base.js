(() => {
    const { protocol, hostname, origin } = window.location;
    const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1';
    const backendOrigin = isLocalhost ? 'http://localhost:3333' : origin;
    window.API_BASE_URL = `${backendOrigin.replace(/\/$/, '')}/api`;
})();
