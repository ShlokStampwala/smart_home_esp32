// Global Theme Switcher
function applyTheme(theme) {
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (theme === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
        document.documentElement.classList.add('dark-mode');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

window.toggleTheme = function() {
    const isLightNow = document.body.classList.contains('light-mode');
    const targetTheme = isLightNow ? 'dark' : 'light';
    localStorage.setItem('smart_home_theme', targetTheme);
    applyTheme(targetTheme);
    if (window.EventBus) {
        window.EventBus.emit('toast', {
            title: 'Theme Switched',
            message: targetTheme === 'light' ? '☀️ Light Mode (White & Black)' : '🌙 Dark Mode',
            type: 'info'
        });
    }
};

// Apply initial theme
const initialTheme = localStorage.getItem('smart_home_theme') || 'dark';
applyTheme(initialTheme);

// App initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('Smart Home System initialized');
    applyTheme(localStorage.getItem('smart_home_theme') || 'dark');

    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
        themeBtn.onclick = function(e) {
            e.preventDefault();
            window.toggleTheme();
        };
    }

    // Initial attempt to connect
    if (window.esp32) {
        setTimeout(() => {
            window.esp32.connect();
        }, 1000);
    }
});
