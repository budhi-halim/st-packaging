function buildSinePath({
  width = 1000,
  height = 200,
  amplitude = 40,
  samples = 100
}) {
  const centerY = height / 2;
  let d = "";

  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * width;
    const t = (i / samples) * Math.PI * 2;
    const y = centerY - Math.sin(t) * amplitude;

    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

document.querySelector("#sine").setAttribute(
  "d",
  buildSinePath({})
);