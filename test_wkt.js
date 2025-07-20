const wkt = 'POINT (-114.1319653 51.0797664)';
console.log('Testing WKT parsing:');
console.log('Input:', wkt);

const pointMatch = wkt.match(/POINT\s*\(\s*([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*\)/i);
if (pointMatch) {
  const longitude = parseFloat(pointMatch[1]);
  const latitude = parseFloat(pointMatch[2]);
  console.log('Parsed longitude:', longitude);
  console.log('Parsed latitude:', latitude);
  console.log('Success!');
} else {
  console.log('Failed to parse WKT');
}
