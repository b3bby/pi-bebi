(() => {
    const backendOrigin = 'http://localhost:3333';
    window.API_BASE_URL = `${backendOrigin.replace(/\/$/, '')}/api`;
})();
