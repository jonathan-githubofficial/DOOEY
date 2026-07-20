// Placeholder boot surface for unit 1.1. Real views arrive with the router
// (unit 3.1) and the ported features (L4+). Lynx <text> does not inherit CSS,
// so colour is set explicitly.
export function App() {
  return (
    <view
      className='bg-paper'
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <text
        id='app-root'
        className='text-ink font-display'
        style={{ color: 'hsl(28 12% 14%)', fontSize: '40px' }}
      >
        DOOEY
      </text>
    </view>
  )
}
