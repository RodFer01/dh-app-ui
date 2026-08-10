import { useOutlookToken } from '../lib/useOutlookToken'

export function OutlookTokenBanner() {
  const { tokenValid, expiresIn, isWaiting, openRelay } = useOutlookToken()

  if (tokenValid && (expiresIn == null || expiresIn > 10)) return null

  const expiringSoon = tokenValid && expiresIn != null && expiresIn <= 10

  function handleRenew() {
    // Open both windows simultaneously
    window.open('https://outlook.office.com/mail', 'outlook_win', 'width=800,height=700,left=100,top=50')
    setTimeout(() => openRelay(), 500)
  }

  return (
    <div style={{
      background: expiringSoon ? '#FFF3E0' : '#FFEBEE',
      border: `1px solid ${expiringSoon ? '#FFB74D' : '#EF9A9A'}`,
      borderRadius: '.5rem', padding: '.625rem 1rem',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <span style={{ fontSize: '.8125rem', color: expiringSoon ? '#E65100' : '#BB0000', fontWeight: 600 }}>
          {isWaiting
            ? '⏳ Waiting — click the Outlook bookmark and come back'
            : expiringSoon
            ? `⚠️ Outlook token expires in ${expiresIn} min`
            : '⚠️ Outlook token expired'}
        </span>
        <button
          onClick={handleRenew}
          disabled={isWaiting}
          style={{
            padding: '.4rem 1rem', background: '#0070f2', color: '#fff',
            borderRadius: '.375rem', fontSize: '.8125rem', fontWeight: 700,
            border: 'none', cursor: isWaiting ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          🔑 Connect Outlook
        </button>
      </div>
      {isWaiting && (
        <div style={{ marginTop: '.5rem', fontSize: '.75rem', color: '#BB0000', background: '#fff3e0', padding: '.5rem .75rem', borderRadius: '.25rem', lineHeight: 1.5 }}>
          <strong>2 windows open:</strong><br/>
          1. No <strong>Outlook</strong> — clique o favorito <strong>"Conectar ao DH App"</strong><br/>
          2. Na janela de <strong>Setup</strong> — o token será salvo automaticamente
        </div>
      )}
    </div>
  )
}
