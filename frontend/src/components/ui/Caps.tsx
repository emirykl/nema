/**
 * Renders text inside an all-caps context while keeping the token name
 * "nUSDT0" correctly cased.
 */
export function Caps({ children }: { children: string }) {
  const parts = children.split("nUSDT0");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && (
            <>
              <span className="normal-case">n</span>USDT0
            </>
          )}
          {part}
        </span>
      ))}
    </>
  );
}
