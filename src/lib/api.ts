import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// FastAPI expects repeated params without brackets: key=a&key=b
// Axios default sends key[]=a&key[]=b — override the serializer
function paramsSerializer(params: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === '') continue
    if (Array.isArray(val)) {
      for (const item of val) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
    }
  }
  return parts.join('&')
}

const api = axios.create({ baseURL: BASE_URL, paramsSerializer })

// Inject JWT from localStorage + Outlook token if available
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('dh_token')
  if (token && cfg.headers) cfg.headers.Authorization = `Bearer ${token}`
  // Automatically send Outlook token for endpoints that need calendar/mail access
  const outlookToken = localStorage.getItem('dh_outlook_token')
  if (outlookToken && cfg.headers) {
    cfg.headers['X-Cal-Auth'] = outlookToken
  }
  return cfg
})

// 401 → clear token + redirect (but NOT for Outlook/draft endpoints — show inline error)
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      const url = err.config?.url || ''
      const isOutlookEndpoint = url.includes('/email/')
        || url.includes('/scheduler/')
        || url.includes('/draft/')
        || url.includes('/api/outlook/')
        || url.includes('/api/calendar/')
        || url.includes('/api/ess/')
      if (!isOutlookEndpoint) {
        localStorage.removeItem('dh_token')
        localStorage.removeItem('dh_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
