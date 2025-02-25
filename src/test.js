alert('Basic test');
console.log('Test script loaded');

const root = document.getElementById('root');
if (root) {
    root.innerHTML = '<h1>Basic test page</h1>';
} else {
    alert('No root element found');
} 