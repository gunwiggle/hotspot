const BASE_URL = 'https://hotspot.maxxarena.de'
const LOGIN_URL = `${BASE_URL}/?auth=ticket&pageID=page-0`
const CONNECTIVITY_URL = 'https://connectivitycheck.gstatic.com/generate_204'

export async function performLogin(username: string, password: string): Promise<boolean> {
    try {
        await fetch(BASE_URL, {
            method: 'GET',
            mode: 'no-cors',
            credentials: 'include',
        })
    } catch { }

    try {
        const formData = new URLSearchParams()
        formData.append('auth', 'ticket')
        formData.append('lp-screen-size', '390:844:390:844')
        formData.append('lp-input-username', username)
        formData.append('lp-input-password', password)
        formData.append('submit-login', 'Oturum aç')

        await fetch(LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            mode: 'no-cors',
            credentials: 'include',
            redirect: 'follow',
        })

        await new Promise(r => setTimeout(r, 1500))

        const connected = await checkConnection()
        return connected
    } catch {
        await new Promise(r => setTimeout(r, 1000))
        const connected = await checkConnection()
        return connected
    }
}

export async function performLogout(): Promise<boolean> {
    try {
        const formData = new URLSearchParams()
        formData.append('logout', '1')

        await fetch(BASE_URL + '/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            mode: 'no-cors',
            credentials: 'include',
        })

        await new Promise(r => setTimeout(r, 1000))
        const connected = await checkConnection()
        return !connected
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
        return Math.round(performance.now() - start)
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
