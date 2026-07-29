export function getCookie(name) {
    if (typeof document === 'undefined') return null; // Guard against SSR
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

export function setCookie(name, value, days) {
    if (typeof document === 'undefined') return; // Guard against SSR
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

export function removeCookie(name) {
    if (typeof document === 'undefined') return; // Guard against SSR
    document.cookie = name + '=; Max-Age=-99999999;';
}
