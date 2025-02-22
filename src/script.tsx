alert('Script starting');
console.log('Basic test script');

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (root) {
        root.innerHTML = '<h1>Test: If you see this, the script is loading</h1>';
        
        // Test keyboard events
        document.addEventListener('keydown', (e) => {
            console.log('Key pressed:', e.code);
            root.innerHTML += `<p>Key pressed: ${e.code}</p>`;
        });
    } else {
        alert('Root element not found!');
    }
}); 