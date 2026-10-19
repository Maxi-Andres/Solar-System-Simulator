import { useClosing } from './Presence.tsx';

/**
 * Shared chrome for the slide-over panels the toolbar opens.
 *
 * Animates in and out on its own: every panel gets it by being a Panel, and the one
 * wrapped in `Presence` in App.tsx gets the closing half too. See index.css.
 */
export function Panel({
  title,
  onClose,
  children,
  width = '15rem',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  const closing = useClosing();
  return (
    <div
      className={closing ? 'panel-exit' : 'panel-enter'}
      style={{
        position: 'absolute',
        top: '50%',
        right: '4.1rem',
        transform: 'translateY(-50%)',
        width,
        maxHeight: '80vh',
        overflowY: 'auto',
        // No backdrop blur, and that is a performance decision. Blurring what lies behind
        // a panel means blurring it again every time that changes, and behind every panel
        // is a WebGL canvas that redraws whenever the scene moves -- so the compositor
        // re-blurred this rectangle up to sixty times a second, on a laptop whose GPU
        // shares the CPU's memory. At 94 % opacity the blur only ever touched the 6 % that
        // showed through;
        // 97 % halves that, and what is left of a star behind the panel is too faint to
        // tell sharp from soft.
        background: 'rgba(14,14,17,0.97)',
        border: '1px solid #262626',
        borderRadius: '0.4rem',
        padding: '1rem 1.1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: '#e8e8e8' }}>
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6a6a6a',
            cursor: 'pointer',
            fontSize: '1.1rem',
            lineHeight: 1,
            padding: '0 0.15rem',
          }}
        >
          &rsaquo;
        </button>
      </div>
      {children}
    </div>
  );
}
