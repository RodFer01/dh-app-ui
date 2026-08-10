/**
 * useOutlookToken — token management via backend bridge.
 *
 * Fluxo completo:
 *   1. openRelay() → POST /api/outlook/open  → backend abre Edge com Outlook
 *   2. Relay html é aberto em janela popup (instrução bookmarklet)
 *   3. Bookmarklet extrai token do Outlook e faz POST /api/outlook/token na API local
 *   4. polling GET /api/outlook/token até receber { ready: true, token, expires_on }
 *   5. Token salvo em localStorage + estado atualizado
 *
 * Fallback: se API não responder, o relay usa postMessage (mesma origem).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { BASE_URL } from './api'

const STORAGE_KEY = 'dh_outlook_token'
const EXPIRY_KEY  = 'dh_outlook_token_expiry'

export function useOutlookToken() {
  const [tokenValid, setTokenValid] = useState(false)
  const [expiresIn,  setExpiresIn]  = useState<number | null>(null)
  const [isWaiting,  setIsWaiting]  = useState(false)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimer    = useRef<ReturnType<typeof setInterval> | null>(null)
  const relayWin     = useRef<Window | null>(null)

  function applyToken(t: string, expiresOn: number) {
    const mins = Math.max(0, Math.round((expiresOn * 1000 - Date.now()) / 60000))
    localStorage.setItem(STORAGE_KEY, t)
    localStorage.setItem(EXPIRY_KEY, String(expiresOn))
    setTokenValid(true)
    setExpiresIn(mins)
    setIsWaiting(false)
    setErrorMsg(null)
    scheduleExpiry(mins)
    if (pollTimer.current) clearInterval(pollTimer.current)
    if (relayWin.current && !relayWin.current.closed) relayWin.current.close()
  }

  function scheduleExpiry(minutesLeft: number) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const delay = Math.max(minutesLeft - 5, 1) * 60 * 1000
    refreshTimer.current = setTimeout(() => {
      setTokenValid(false)
      setExpiresIn(null)
    }, delay)
  }

  function getToken(): string | null {
    const t   = localStorage.getItem(STORAGE_KEY)
    const exp = parseFloat(localStorage.getItem(EXPIRY_KEY) || '0')
    return (t && exp > Date.now() / 1000 + 30) ? t : null
  }

  function tokenHeaders(): Record<string, string> {
    const t = getToken()
    return t ? { 'X-Cal-Auth': t } : {}
  }

  function calToken(): string {
    return getToken() || ''
  }

  // Inicia polling na API backend
  function startPolling(win: Window | null) {
    if (pollTimer.current) clearInterval(pollTimer.current)
    const started = Date.now()

    pollTimer.current = setInterval(async () => {
      // Timeout após 3 minutos
      if (Date.now() - started > 3 * 60_000) {
        clearInterval(pollTimer.current!)
        setIsWaiting(false)
        setErrorMsg('Tempo esgotado. Tente novamente.')
        return
      }

      // Janela fechada sem sucesso
      if (win && win.closed) {
        // Ainda aguarda 10s (bookmarklet pode ter feito POST direto)
        if (Date.now() - started > 10_000) {
          clearInterval(pollTimer.current!)
          setIsWaiting(false)
        }
      }

      try {
        const res = await fetch(`${BASE_URL}/api/outlook/token`)
        const data = await res.json()
        if (data.ready && data.token) {
          clearInterval(pollTimer.current!)
          applyToken(data.token, data.expires_on)
        }
      } catch {
        // API indisponível — continua aguardando postMessage
      }

      // Fallback: verificar localStorage (postMessage do relay)
      const t   = localStorage.getItem(STORAGE_KEY)
      const exp = parseFloat(localStorage.getItem(EXPIRY_KEY) || '0')
      if (t && exp > Date.now() / 1000 + 30) {
        clearInterval(pollTimer.current!)
        applyToken(t, exp)
      }
    }, 1500)
  }

  useEffect(() => {
    const t   = localStorage.getItem(STORAGE_KEY)
    const exp = parseFloat(localStorage.getItem(EXPIRY_KEY) || '0')
    if (t && exp > Date.now() / 1000 + 60) {
      const mins = Math.round((exp * 1000 - Date.now()) / 60000)
      setTokenValid(true)
      setExpiresIn(mins)
      scheduleExpiry(mins)
    }

    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'OUTLOOK_TOKEN' && e.data.token) {
        applyToken(e.data.token, e.data.expiresOn)
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [])

  const openRelay = useCallback(async () => {
    setIsWaiting(true)
    setErrorMsg(null)

    // Abre Outlook no mesmo browser (nova aba) — bookmarklet precisa estar no mesmo browser
    window.open('https://outlook.office.com/mail', '_blank')

    // Abre popup com instruções do bookmarklet (após 500ms para não bloquear)
    setTimeout(() => {
      const w = window.open(
        '/outlook-relay.html',
        'dh_outlook_relay',
        'width=520,height=560,left=100,top=80,toolbar=no,location=no,menubar=no,status=no'
      )
      relayWin.current = w
      if (!w) {
        setErrorMsg('Popup bloqueado. Permita popups para sapdh.local e tente novamente.')
      }
    }, 500)

    // Inicia polling
    startPolling(null)
  }, [])

  const autoRenew = openRelay

  return { tokenValid, expiresIn, isWaiting, errorMsg, openRelay, autoRenew, getToken, tokenHeaders, calToken }
}
