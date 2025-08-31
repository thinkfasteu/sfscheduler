window.onerror = (msg, url, line, col, error) => {
    console.error('Global error:', { msg, url, line, col, error });
    alert('Ein Fehler ist aufgetreten. Bitte laden Sie die Seite neu.');
    return false;
};
