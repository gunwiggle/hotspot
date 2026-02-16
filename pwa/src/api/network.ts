const AUTH_URL = 'https://hotspot.maxxarena.de/logon'
const LOGOUT_URL = 'https://hotspot.maxxarena.de/logoff'
const CONNECTIVITY_URL = 'https://connectivitycheck.gstatic.com/generate_204'

export async function performLogin(username: string, password: string): Promise<boolean> {
    try {
        const formData = new URLSearchParams()
        formData.append('username', username)
        formData.append('password', password)

        const response = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
            redirect: 'follow',
        })

        const text = await response.text()
        return text.includes('Login successful') ||
            text.includes('already logged') ||
            text.includes('Erfolgreich') ||
            response.ok
    } catch {
        const connected = await checkConnection()
        return connected
    }
}

export async function performLogout(): Promise<boolean> {
    try {
        const response = await fetch(LOGOUT_URL, {
            method: 'POST',
            redirect: 'follow',
        })
        return response.ok
    } catch {
        return false
    }
}

export async function checkConnection(): Promise<boolean> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(CONNECTIVITY_URL, {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors',
        })

        clearTimeout(timeout)
        return response.status === 204 || response.type === 'opaque'
    } catch {
        return false
    }
}

export async function measurePing(): Promise<number | null> {
    try {
        const start = performance.now()
        await fetch(CONNECTIVITY_URL, { method: 'HEAD', mode: 'no-cors' })
        const end = performance.now()
        return Math.round(end - start)
    } catch {
        return null
    }
}

export async function fetchPublicIp(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=text')
        return await response.text()
    } catch {
        return '-'
    }
}
