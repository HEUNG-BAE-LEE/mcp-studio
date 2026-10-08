// globe — 이음 원본 util.js I.globe 그대로
export default function Globe() {
  return (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20" />
    </>
  );
}
